#!/usr/bin/env python3
"""
Test Redis connectivity and write permissions for Celery configuration.
This script helps diagnose Redis read-only replica issues.
"""
import os
import sys
import redis
from redis.exceptions import RedisError, ReadOnlyError

def test_redis_connectivity():
    """Test Redis connectivity and write permissions."""
    broker_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    result_backend = os.getenv("CELERY_RESULT_BACKEND", broker_url)

    print("🔍 Testing Redis Connectivity for Celery")
    print(f"Broker URL: {broker_url}")
    print(f"Result Backend: {result_backend}")
    print("-" * 50)

    # Test broker connection
    try:
        print("Testing broker connection...")
        broker_client = redis.from_url(broker_url)
        broker_client.ping()
        print("✅ Broker connection successful")

        # Test write operation (this is what Celery needs)
        test_key = "celery:test:connectivity"
        broker_client.set(test_key, "test_value", ex=60)
        value = broker_client.get(test_key)
        broker_client.delete(test_key)

        if value == b"test_value":
            print("✅ Broker write operations successful")
        else:
            print("❌ Broker write test failed")
            return False

    except ReadOnlyError as e:
        print(f"❌ Broker is read-only replica: {e}")
        print("💡 SOLUTION: Ensure CELERY_BROKER_URL points to Redis master node")
        return False
    except RedisError as e:
        print(f"❌ Broker connection failed: {e}")
        return False

    # Test result backend connection (if different from broker)
    if result_backend != broker_url:
        try:
            print("Testing result backend connection...")
            backend_client = redis.from_url(result_backend)
            backend_client.ping()
            print("✅ Result backend connection successful")

            # Test write operation
            test_key = "celery:test:result_backend"
            backend_client.set(test_key, "test_value", ex=60)
            value = backend_client.get(test_key)
            backend_client.delete(test_key)

            if value == b"test_value":
                print("✅ Result backend write operations successful")
            else:
                print("❌ Result backend write test failed")
                return False

        except ReadOnlyError as e:
            print(f"❌ Result backend is read-only replica: {e}")
            print("💡 SOLUTION: Ensure CELERY_RESULT_BACKEND points to Redis master node")
            return False
        except RedisError as e:
            print(f"❌ Result backend connection failed: {e}")
            return False
    else:
        print("ℹ️  Result backend uses same connection as broker")

    print("-" * 50)
    print("🎉 All Redis connectivity tests passed!")
    print("Celery should be able to connect and perform write operations.")
    return True

def diagnose_redis_cluster():
    """Diagnose Redis cluster configuration."""
    broker_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")

    print("\n🔍 Diagnosing Redis Configuration")
    print("-" * 50)

    try:
        client = redis.from_url(broker_url)

        # Check if this is a cluster
        try:
            cluster_info = client.cluster("info")
            print("📊 Redis Cluster Info:")
            for line in cluster_info.decode().split('\n'):
                if line.strip():
                    print(f"  {line}")
        except RedisError:
            print("ℹ️  Not a Redis cluster (single instance)")

        # Check replication info
        try:
            replication_info = client.info("replication")
            print("🔄 Replication Info:")
            role = replication_info.get('role', 'unknown')
            print(f"  Role: {role}")

            if role == 'slave':
                print("❌ This Redis instance is configured as a SLAVE/REPLICA")
                print("💡 SOLUTION: Use master Redis instance for Celery")
                master_host = replication_info.get('master_host', 'unknown')
                master_port = replication_info.get('master_port', 'unknown')
                if master_host != 'unknown':
                    print(f"   Master location: {master_host}:{master_port}")
            elif role == 'master':
                print("✅ This Redis instance is the MASTER")
            else:
                print(f"⚠️  Unknown role: {role}")

        except RedisError as e:
            print(f"⚠️  Could not get replication info: {e}")

    except Exception as e:
        print(f"❌ Could not diagnose Redis: {e}")

if __name__ == "__main__":
    success = test_redis_connectivity()
    diagnose_redis_cluster()

    if not success:
        print("\n🚨 Redis connectivity issues detected!")
        print("Common solutions:")
        print("1. Ensure CELERY_BROKER_URL points to Redis master (not replica)")
        print("2. Check if Redis is in cluster mode and use correct master node")
        print("3. Verify Redis configuration allows writes")
        print("4. Check network connectivity to Redis host")
        sys.exit(1)
    else:
        print("\n✅ Redis configuration looks good!")
        sys.exit(0)
