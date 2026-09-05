import os
import sys
import traceback
import uvicorn

def main():
    port = int(os.environ.get("PORT", 10000))
    print(f"Starting SentiNews Learn backend on 0.0.0.0:{port}...")
    try:
        uvicorn.run("app.main:app", host="0.0.0.0", port=port, log_level="info")
    except Exception as e:
        print(f"CRITICAL ERROR STARTING APPLICATION: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
