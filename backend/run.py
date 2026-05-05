from app import create_app

app = create_app()

if __name__ == "__main__":
    # for development only
    # Some restricted environments (e.g., WSL/containers) can block /dev/shm usage
    # used by the Werkzeug interactive debugger. Keep hot reload, disable debugger.
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=True, use_debugger=False)