from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import os
import sys
import importlib.util
import traceback

DEFAULT_PORT = 5001

app = Flask(__name__)
CORS(app)

query_module = None
try:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    query_path = os.path.join(current_dir, "query.py")
    spec = importlib.util.spec_from_file_location("query", query_path)
    query_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(query_module)
    print("Query module loaded successfully")
except Exception as e:
    print(f"Error loading query module: {e}")
    traceback.print_exc()

@app.route('/test-query', methods=['GET'])
def test_query():
    if query_module and hasattr(query_module, 'query'):
        try:
            result = query_module.query("This is a test prompt")
            return jsonify({
                "status": "success",
                "has_query_function": True,
                "test_result": result
            })
        except Exception as e:
            return jsonify({
                "status": "error",
                "has_query_function": True,
                "error": str(e),
                "traceback": traceback.format_exc()
            })
    else:
        # Check what attributes the module does have
        attributes = dir(query_module) if query_module else []
        return jsonify({
            "status": "error",
            "has_query_function": False,
            "module_loaded": query_module is not None,
            "available_attributes": attributes
        })

@app.before_request
def log_request():
    print(f"Received {request.method} request to {request.path}")
    print(f"Headers: {dict(request.headers)}")
    if request.method == 'POST':
        try:
            print(f"POST data: {request.get_json(silent=True)}")
        except Exception as e:
            print(f"Error processing POST data: {e}")

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 
                        'Content-Type, Authorization, X-Requested-With, Accept, Origin')
    response.headers.add('Access-Control-Allow-Methods', 
                        'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route('/', methods=['GET'])
def index():
    return jsonify({"message": "Flask API is running. Try /health, /api/tags, or /api/generate"})

@app.route('/health', methods=['GET', 'OPTIONS'])
def health_check():
    if request.method == 'OPTIONS':
        return make_response('', 204)
    return jsonify({"status": "ok"})

@app.route('/api/generate', methods=['POST', 'OPTIONS'])
def generate_text():
    if request.method == 'OPTIONS':
        return make_response('', 204)
    
    try:
        data = request.get_json(force=True)
    except Exception as e:
        print(f"Error parsing JSON: {e}")
        try:
            raw_data = request.get_data()
            print(f"Raw data received: {raw_data}")
        except:
            pass
        return jsonify({"error": "Invalid JSON data"}), 400
    
    model = data.get('model', 'gemma3')
    prompt = data.get('prompt', '')
    
    try:
        if query_module and hasattr(query_module, 'query'):
            result = query_module.query(prompt)
            
            return jsonify({
                "response": result or f"No response generated for: {prompt}",
                "model": model
            })
        else:
            return jsonify({
                "response": f"Query function not available. Prompt was: {prompt}",
                "model": model
            })
    except Exception as e:
        print(f"Error generating response: {e}")
        traceback.print_exc()
        return jsonify({
            "response": f"Error generating response: {str(e)}",
            "model": model
        }), 500

@app.route('/api/tags', methods=['GET', 'OPTIONS'])
def get_models():
    if request.method == 'OPTIONS':
        return make_response('', 204)
        
    models = [
        {"name": "gemma3"},
    ]
    
    return jsonify({"models": models})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', DEFAULT_PORT))
    print(f"Starting Flask server on port {port}...")
    
    max_port_attempts = 10
    current_port = port
    
    for attempt in range(max_port_attempts):
        try:
            app.run(host='0.0.0.0', port=current_port, debug=True, threaded=True)
            break
        except OSError as e:
            if "Address already in use" in str(e):
                print(f"Port {current_port} is already in use.")
                current_port += 1
                print(f"Trying port {current_port}...")
            else:
                raise
    else:
        print(f"Failed to find an available port after {max_port_attempts} attempts.")
        print("Please specify an available port by setting the PORT environment variable.")
        sys.exit(1)