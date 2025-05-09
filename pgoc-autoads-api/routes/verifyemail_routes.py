from flask import Blueprint, request, jsonify, render_template
import redis
from models.models import db, User
from datetime import datetime
from uuid import uuid4
from sqlalchemy.exc import SQLAlchemyError
from workers.send_email import send_email_task  # Import shared task

# Initialize Blueprint
email_verification_bp = Blueprint('email_verification', __name__)

# Redis client for email verification (db=6)
redis_client_email = redis.Redis(host='redis', port=6379, db=6, decode_responses=True)

# Generate a unique verification code (UUID)
def generate_verification_code():
    return str(uuid4())[:6]  # Shorten UUID to 6 characters

# Endpoint to request email verification
@email_verification_bp.route('/verify-email', methods=['POST'])
def send_verification_email():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('domain'):
        return jsonify({'message': 'Email and domain are required'}), 400

    email = data['email']
    domain = data['domain']

    try:
        # Check if the email already exists in the database
        user = db.session.query(User).filter_by(email=email, userdomain=domain).first()
        if user:
            return jsonify({'message': 'Email is already registered'}), 400

        # Generate verification code and save in Redis (expires in 10 minutes)
        verification_code = generate_verification_code()
        redis_client_email.setex(f"email_verification:{verification_code}", 600, email)

        # Prepare email content before passing to Celery
        html_content = render_template(
            'verification.html',
            verification_code=verification_code,
            domain=domain,
            year=datetime.now().year
        )

        # Call Celery shared task asynchronously
        send_email_task.apply_async(args=[email, "Email Verification Code", html_content])

        return jsonify({'message': 'Verification email is being sent'}), 200

    except SQLAlchemyError as e:
        return jsonify({'message': 'Database error', 'error': str(e)}), 500


# Endpoint to verify email token
@email_verification_bp.route('/verify-email/<token>', methods=['GET'])
def verify_email(token):
    # Check if the token exists in Redis
    email = redis_client_email.get(f"email_verification:{token}")
    if not email:
        return jsonify({'message': 'Invalid or expired verification token'}), 400

    # Token is valid, return success response
    return jsonify({'message': 'Token is valid. Email verified successfully.'}), 200
