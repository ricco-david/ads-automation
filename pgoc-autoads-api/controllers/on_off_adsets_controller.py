import time
from flask import Blueprint, request, jsonify
import redis
import json
from workers.on_off_adsets_worker import fetch_adsets

# Initialize Redis connection
redis_websocket_as = redis.Redis(
    host="redisAds",
    port=6379,
    db=15,  
    decode_responses=True
)

def add_adset_off(data):
    data = request.get_json()

    ad_account_id = data.get("ad_account_id")
    user_id = data.get("user_id")
    access_token = data.get("access_token")
    schedule_data = data.get("schedule_data")  # This will always have one entry

    if not (ad_account_id and user_id and access_token and schedule_data):
        return jsonify({"error": "Missing required fields"}), 400

    # Create WebSocket Redis key if it doesn’t exist
    websocket_key = f"{user_id}-key"
    if not redis_websocket_as.exists(websocket_key):
        redis_websocket_as.set(websocket_key, json.dumps({"message": ["User-Id Created"]}))

    # Since every call has only one schedule, directly process it
    schedule = schedule_data[0]

    if schedule["on_off"] not in ["ON", "OFF"]:
        return jsonify({"error": f"Invalid on_off value. Use 'ON' or 'OFF'"}), 400

    # Introduce a delay before calling Celery Task (2-second delay)
    fetch_adsets.apply_async(args=[user_id, ad_account_id, access_token, schedule_data[0]], countdown=0)

    return jsonify({"message": "Adset schedule will be processed."}), 201