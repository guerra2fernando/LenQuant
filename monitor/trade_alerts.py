"""Lightweight alerting utilities for trading events."""
from __future__ import annotations

import json
import logging
import os
import smtplib
from email.mime.text import MIMEText
from typing import Any, Dict, Iterable, Optional
from urllib import request as urlrequest

from exec.risk_manager import AlertSettings

LOGGER = logging.getLogger(__name__)


class TradeAlertClient:
    """Dispatches trading alerts to configured channels."""

    def __init__(self, settings: AlertSettings) -> None:
        self.settings = settings
        self.logger = LOGGER
        # Initialize notification service for in-app notifications
        try:
            from monitor.notification_service import NotificationService
            self.notification_service = NotificationService()
        except Exception:
            self.notification_service = None

    def send_alert(
        self,
        *,
        title: str,
        message: str,
        severity: str = "info",
        extra: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
    ) -> None:
        payload = {"title": title, "message": message, "severity": severity, "extra": extra or {}}
        
        # Send to external channels (Slack, Telegram, Email)
        for channel in self.settings.channels:
            try:
                if channel == "slack":
                    self._send_slack(payload)
                elif channel == "telegram":
                    self._send_telegram(payload)
                elif channel == "email":
                    self._send_email(payload)
                else:
                    self.logger.info("Alert [%s] %s - %s", severity.upper(), title, message)
            except Exception as exc:  # pylint: disable=broad-except
                self.logger.warning("Failed to dispatch %s alert: %s", channel, exc)
        
        # Create in-app notification if user_id is provided and notification service is available
        if user_id and self.notification_service:
            try:
                # Determine notification type from extra metadata or default to system_event
                notification_type = extra.get("notification_type", "system_event") if extra else "system_event"
                
                self.notification_service.create_notification(
                    user_id=user_id,
                    type=notification_type,
                    severity=severity,
                    title=title,
                    message=message,
                    metadata=extra or {},
                )
            except Exception as exc:  # pylint: disable=broad-except
                self.logger.warning("Failed to create in-app notification: %s", exc)

    def send_cohort_alert(
        self,
        *,
        cohort_id: str,
        title: str,
        message: str,
        severity: str = "warning",
        metrics: Optional[Dict[str, Any]] = None,
    ) -> None:
        extra = {"cohort_id": cohort_id}
        if metrics:
            extra["metrics"] = metrics
        self.send_alert(title=title, message=message, severity=severity, extra=extra)

    def notify_parent_drawdown(self, cohort_id: str, drawdown_pct: float, threshold_pct: float) -> None:
        message = (
            f"Parent wallet drawdown {drawdown_pct:.2%} exceeded threshold {threshold_pct:.2%}."
        )
        self.send_cohort_alert(
            cohort_id=cohort_id,
            title="Parent Wallet Drawdown Breach",
            message=message,
            severity="critical" if drawdown_pct >= threshold_pct * 1.5 else "warning",
            metrics={"drawdown_pct": drawdown_pct, "threshold_pct": threshold_pct},
        )

    def notify_leverage_breach(
        self,
        cohort_id: str,
        strategy_id: str,
        leverage_multiple: float,
        ceiling: float,
    ) -> None:
        message = (
            f"Agent {strategy_id} leverage {leverage_multiple:.2f}× breached ceiling {ceiling:.2f}×."
        )
        self.send_cohort_alert(
            cohort_id=cohort_id,
            title="Agent Leverage Breach",
            message=message,
            severity="warning",
            metrics={
                "strategy_id": strategy_id,
                "leverage": leverage_multiple,
                "ceiling": ceiling,
            },
        )

    def notify_bankroll_utilisation(
        self,
        cohort_id: str,
        utilisation_pct: float,
        threshold_pct: float,
    ) -> None:
        message = (
            f"Cohort bankroll utilisation {utilisation_pct:.2%} surpassed threshold {threshold_pct:.2%}."
        )
        self.send_cohort_alert(
            cohort_id=cohort_id,
            title="Bankroll Utilisation Alert",
            message=message,
            severity="warning" if utilisation_pct < threshold_pct * 1.2 else "critical",
            metrics={
                "utilisation_pct": utilisation_pct,
                "threshold_pct": threshold_pct,
            },
        )

    # ------------------------------------------------------------------ #
    # Channels
    # ------------------------------------------------------------------ #
    def _send_slack(self, payload: Dict[str, Any]) -> None:
        webhook_env = self.settings.slack_webhook_env
        if not webhook_env:
            self.logger.debug("Slack webhook not configured.")
            return
        webhook = os.getenv(webhook_env)
        if not webhook:
            self.logger.debug("Slack webhook env '%s' empty.", webhook_env)
            return
        body = json.dumps({"text": f"*{payload['title']}*\n{payload['message']}"})
        req = urlrequest.Request(
            webhook,
            data=body.encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urlrequest.urlopen(req, timeout=5) as response:  # nosec B310
            if response.status >= 400:
                raise RuntimeError(f"Slack webhook responded {response.status}")

    def _send_telegram(self, payload: Dict[str, Any]) -> None:
        token_env = self.settings.telegram_bot_token_env
        chat_env = self.settings.telegram_chat_id_env
        if not token_env or not chat_env:
            self.logger.debug("Telegram credentials not configured.")
            return
        token = os.getenv(token_env)
        chat_id = os.getenv(chat_env)
        if not token or not chat_id:
            self.logger.debug("Telegram env vars empty.")
            return
        text = f"[{payload['severity'].upper()}] {payload['title']}\n{payload['message']}"
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        data = json.dumps({"chat_id": chat_id, "text": text}).encode("utf-8")
        req = urlrequest.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urlrequest.urlopen(req, timeout=5) as response:  # nosec B310
            if response.status >= 400:
                raise RuntimeError(f"Telegram API responded {response.status}")

    def _send_email(self, payload: Dict[str, Any]) -> None:
        smtp_env = self.settings.email_smtp_env
        if not smtp_env:
            self.logger.debug("Email SMTP env not configured.")
            return
        smtp_host = os.getenv(smtp_env)
        if not smtp_host:
            self.logger.debug("SMTP host env '%s' empty.", smtp_env)
            return

        recipients = self.settings.email_recipients
        email_from = self.settings.email_from or os.getenv(self.settings.email_username_env or "", "")
        if not recipients or not email_from:
            self.logger.debug("Email recipients or from address missing.")
            return

        msg = MIMEText(payload["message"])
        msg["Subject"] = payload["title"]
        msg["From"] = email_from
        msg["To"] = ", ".join(recipients)

        username = os.getenv(self.settings.email_username_env or "", "")
        password = os.getenv(self.settings.email_password_env or "", "")

        with smtplib.SMTP(smtp_host, 587, timeout=5) as smtp:
            smtp.starttls()
            if username and password:
                smtp.login(username, password)
            smtp.sendmail(email_from, recipients, msg.as_string())


