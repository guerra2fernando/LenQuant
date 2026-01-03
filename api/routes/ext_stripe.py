"""
Stripe integration for Chrome extension payments.

Provides:
- Checkout session creation
- Subscription management
- Webhook handling
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import stripe
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr

from db.client import get_database_name, mongo_client

logger = logging.getLogger(__name__)

router = APIRouter()

# Configure Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Configuration
COLLECTION = "extension_users"
PRICE_MAP = {
    "pro_monthly": os.getenv("STRIPE_PRICE_PRO_MONTHLY"),
    "pro_yearly": os.getenv("STRIPE_PRICE_PRO_YEARLY"),
    "premium_monthly": os.getenv("STRIPE_PRICE_PREMIUM_MONTHLY"),
    "premium_yearly": os.getenv("STRIPE_PRICE_PREMIUM_YEARLY"),
}

PLAN_TO_TIER = {
    "pro_monthly": "pro",
    "pro_yearly": "pro",
    "premium_monthly": "premium",
    "premium_yearly": "premium",
}

SUCCESS_URL = os.getenv("STRIPE_SUCCESS_URL", "https://lenquant.com/extension/payment-success")
CANCEL_URL = os.getenv("STRIPE_CANCEL_URL", "https://lenquant.com/extension/payment-canceled")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")


def _utcnow() -> datetime:
    return datetime.utcnow().replace(tzinfo=timezone.utc)


# ============================================================================
# Request/Response Models
# ============================================================================


class CheckoutRequest(BaseModel):
    """Request to create checkout session."""
    email: str
    device_id: str
    plan: str  # pro_monthly, pro_yearly, premium_monthly, premium_yearly


class CheckoutResponse(BaseModel):
    """Checkout session response."""
    checkout_url: str
    session_id: str


class PortalRequest(BaseModel):
    """Request to access billing portal."""
    email: str
    device_id: str


class PortalResponse(BaseModel):
    """Billing portal response."""
    portal_url: str


# ============================================================================
# Checkout & Portal
# ============================================================================


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout_session(payload: CheckoutRequest) -> Dict[str, Any]:
    """
    Create Stripe checkout session for subscription.

    Returns URL to redirect user to Stripe-hosted checkout.
    """
    if not stripe.api_key:
        raise HTTPException(500, "Stripe not configured")

    if payload.plan not in PRICE_MAP:
        raise HTTPException(400, f"Invalid plan: {payload.plan}")

    price_id = PRICE_MAP[payload.plan]
    if not price_id:
        raise HTTPException(500, f"Price not configured for plan: {payload.plan}")

    logger.info("Creating checkout for %s: plan=%s", payload.email, payload.plan)

    with mongo_client() as client:
        db = client[get_database_name()]

        # Find or create customer
        user = db[COLLECTION].find_one({
            "email": payload.email.lower(),
            "device_id": payload.device_id,
        })

        if not user:
            raise HTTPException(404, "User not found. Please register first.")

        # Get or create Stripe customer
        customer_id = user.get("subscription", {}).get("stripe_customer_id")

        if not customer_id:
            # Create Stripe customer
            customer = stripe.Customer.create(
                email=payload.email.lower(),
                metadata={
                    "device_id": payload.device_id,
                    "source": "chrome_extension",
                },
            )
            customer_id = customer.id

            # Save customer ID
            db[COLLECTION].update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "subscription.stripe_customer_id": customer_id,
                    "updated_at": _utcnow(),
                }}
            )

        # Create checkout session
        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                line_items=[{
                    "price": price_id,
                    "quantity": 1,
                }],
                mode="subscription",
                success_url=f"{SUCCESS_URL}?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=CANCEL_URL,
                metadata={
                    "email": payload.email.lower(),
                    "device_id": payload.device_id,
                    "plan": payload.plan,
                },
                subscription_data={
                    "metadata": {
                        "email": payload.email.lower(),
                        "device_id": payload.device_id,
                        "plan": payload.plan,
                    },
                },
            )

            logger.info("Checkout session created: %s", session.id)

            return {
                "checkout_url": session.url,
                "session_id": session.id,
            }

        except stripe.error.StripeError as e:
            logger.error("Stripe checkout error: %s", e)
            raise HTTPException(400, f"Payment error: {str(e)}")


@router.post("/portal", response_model=PortalResponse)
def create_portal_session(payload: PortalRequest) -> Dict[str, Any]:
    """
    Create Stripe billing portal session.

    Allows users to manage subscription, update payment, cancel.
    """
    if not stripe.api_key:
        raise HTTPException(500, "Stripe not configured")

    with mongo_client() as client:
        db = client[get_database_name()]

        user = db[COLLECTION].find_one({
            "email": payload.email.lower(),
            "device_id": payload.device_id,
        })

        if not user:
            raise HTTPException(404, "User not found")

        customer_id = user.get("subscription", {}).get("stripe_customer_id")

        if not customer_id:
            raise HTTPException(400, "No billing information found")

        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=f"{SUCCESS_URL}?from=portal",
            )

            return {"portal_url": session.url}

        except stripe.error.StripeError as e:
            logger.error("Stripe portal error: %s", e)
            raise HTTPException(400, f"Portal error: {str(e)}")


@router.get("/subscription")
def get_subscription_status(
    email: str = Query(...),
    device_id: str = Query(...),
) -> Dict[str, Any]:
    """
    Get current subscription status.
    """
    with mongo_client() as client:
        db = client[get_database_name()]

        user = db[COLLECTION].find_one({
            "email": email.lower(),
            "device_id": device_id,
        })

        if not user:
            raise HTTPException(404, "User not found")

        subscription = user.get("subscription", {})

        return {
            "tier": user.get("tier", "free"),
            "plan": subscription.get("plan"),
            "status": subscription.get("status"),
            "current_period_end": subscription.get("current_period_end"),
            "cancel_at_period_end": subscription.get("cancel_at_period_end", False),
        }


@router.get("/verify-session")
def verify_checkout_session(session_id: str = Query(...)) -> Dict[str, Any]:
    """
    Verify that a checkout session was completed successfully.
    """
    if not stripe.api_key:
        raise HTTPException(500, "Stripe not configured")

    try:
        session = stripe.checkout.Session.retrieve(session_id)

        if session.payment_status == "paid":
            return {"success": True, "session": {"id": session.id, "status": session.status}}
        else:
            return {"success": False, "reason": "Payment not completed"}

    except stripe.error.StripeError as e:
        logger.error("Stripe session verification error: %s", e)
        return {"success": False, "reason": str(e)}


# ============================================================================
# Webhooks
# ============================================================================


@router.post("/webhook")
async def handle_stripe_webhook(request: Request) -> Dict[str, Any]:
    """
    Handle Stripe webhook events.

    Events handled:
    - checkout.session.completed: Subscription created
    - customer.subscription.updated: Subscription changed
    - customer.subscription.deleted: Subscription canceled
    - invoice.payment_succeeded: Payment successful
    - invoice.payment_failed: Payment failed
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not WEBHOOK_SECRET:
        logger.warning("Webhook secret not configured")
        # In development, process without signature verification
        try:
            event = stripe.Event.construct_from(
                stripe.util.json.loads(payload),
                stripe.api_key
            )
        except Exception as e:
            raise HTTPException(400, f"Invalid payload: {e}")
    else:
        # Verify signature
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, WEBHOOK_SECRET
            )
        except stripe.error.SignatureVerificationError:
            logger.error("Invalid webhook signature")
            raise HTTPException(400, "Invalid signature")
        except Exception as e:
            raise HTTPException(400, f"Webhook error: {e}")

    logger.info("Stripe webhook received: %s", event.type)

    # Handle events
    if event.type == "checkout.session.completed":
        await _handle_checkout_completed(event.data.object)

    elif event.type == "customer.subscription.updated":
        await _handle_subscription_updated(event.data.object)

    elif event.type == "customer.subscription.deleted":
        await _handle_subscription_deleted(event.data.object)

    elif event.type == "invoice.payment_succeeded":
        await _handle_payment_succeeded(event.data.object)

    elif event.type == "invoice.payment_failed":
        await _handle_payment_failed(event.data.object)

    return {"received": True}


async def _handle_checkout_completed(session: Any) -> None:
    """Handle successful checkout."""
    logger.info("Checkout completed: %s", session.id)

    metadata = session.get("metadata", {})
    email = metadata.get("email")
    device_id = metadata.get("device_id")
    plan = metadata.get("plan")

    if not email or not plan:
        logger.warning("Missing metadata in checkout session")
        return

    tier = PLAN_TO_TIER.get(plan, "pro")
    subscription_id = session.get("subscription")
    customer_id = session.get("customer")

    with mongo_client() as client:
        db = client[get_database_name()]

        # Get subscription details
        sub_details = stripe.Subscription.retrieve(subscription_id) if subscription_id else None

        update_data = {
            "tier": tier,
            "subscription.stripe_subscription_id": subscription_id,
            "subscription.stripe_customer_id": customer_id,
            "subscription.plan": plan,
            "subscription.status": "active",
            "subscription.current_period_end": (
                datetime.fromtimestamp(sub_details.current_period_end, tz=timezone.utc)
                if sub_details else None
            ),
            "features": _get_features_for_tier(tier),
            "updated_at": _utcnow(),
        }

        result = db[COLLECTION].update_one(
            {"email": email.lower()},
            {"$set": update_data}
        )

        if result.modified_count > 0:
            logger.info("User %s upgraded to %s", email, tier)
        else:
            logger.warning("User %s not found for upgrade", email)


async def _handle_subscription_updated(subscription: Any) -> None:
    """Handle subscription update."""
    customer_id = subscription.get("customer")
    status = subscription.get("status")

    logger.info("Subscription updated: customer=%s status=%s", customer_id, status)

    with mongo_client() as client:
        db = client[get_database_name()]

        update_data = {
            "subscription.status": status,
            "subscription.current_period_end": datetime.fromtimestamp(
                subscription.current_period_end, tz=timezone.utc
            ),
            "subscription.cancel_at_period_end": subscription.get("cancel_at_period_end", False),
            "updated_at": _utcnow(),
        }

        # If subscription not active, downgrade tier
        if status not in ["active", "trialing"]:
            update_data["tier"] = "expired"
            update_data["features"] = _get_features_for_tier("expired")

        db[COLLECTION].update_one(
            {"subscription.stripe_customer_id": customer_id},
            {"$set": update_data}
        )


async def _handle_subscription_deleted(subscription: Any) -> None:
    """Handle subscription cancellation."""
    customer_id = subscription.get("customer")

    logger.info("Subscription deleted: customer=%s", customer_id)

    with mongo_client() as client:
        db = client[get_database_name()]

        db[COLLECTION].update_one(
            {"subscription.stripe_customer_id": customer_id},
            {"$set": {
                "tier": "expired",
                "subscription.status": "canceled",
                "features": _get_features_for_tier("expired"),
                "updated_at": _utcnow(),
            }}
        )


async def _handle_payment_succeeded(invoice: Any) -> None:
    """Handle successful payment (renewal)."""
    customer_id = invoice.get("customer")
    logger.info("Payment succeeded: customer=%s", customer_id)

    # Subscription will be updated via subscription.updated event


async def _handle_payment_failed(invoice: Any) -> None:
    """Handle failed payment."""
    customer_id = invoice.get("customer")
    logger.warning("Payment failed: customer=%s", customer_id)

    # Send notification, subscription.updated will handle status change


def _get_features_for_tier(tier: str) -> list:
    """Get features list for a tier."""
    features = {
        "free": ["basic_analysis"],
        "expired": ["basic_analysis"],
        "trial": ["analysis", "ai_explain", "cloud_journal", "mtf_analysis", "behavioral"],
        "pro": ["analysis", "ai_explain", "cloud_journal", "mtf_analysis", "behavioral"],
        "premium": ["analysis", "ai_explain", "cloud_journal", "mtf_analysis", "behavioral",
                    "trade_sync", "extended_journal", "priority_support"],
    }
    return features.get(tier, ["basic_analysis"])
