from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Initialized in create_app(). Import-safe (no app context needed).
limiter = Limiter(get_remote_address, default_limits=[], storage_uri="memory://")

