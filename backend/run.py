import uvicorn

if __name__ == "__main__":
    # Runs FastAPI server locally on port 8001 with auto-reload enabled
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
