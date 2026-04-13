# Debug Log Templates

This reference provides language and framework-specific logging patterns for debug instrumentation. The MCP tool `debug_get_log_templates` generates these dynamically, but this document provides additional context for framework-aware instrumentation.

## General Pattern

All debug log entries follow this NDJSON format:
```json
{"hypothesis":"H1","message":"description of what's being logged","data":{"key":"value"},"file":"path/to/file.ext","line":42,"timestamp":"2025-01-01T00:00:00.000Z"}
```

Always wrap instrumentation in region markers:
```
<region-start>
<log statement>
<region-end>
```

## Framework-Specific Instrumentation Patterns

### Next.js (React)

**API Route instrumentation:**
```typescript
// #region DEBUG
export async function GET(request: Request) {
  fetch('http://127.0.0.1:PORT/log', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({hypothesis:'H1', message:'API route entry', data:{url: request.url, method: request.method}})}).catch(()=>{});
  // ... original handler code
}
// #endregion DEBUG
```

**React component re-render tracking:**
```typescript
// #region DEBUG
useEffect(() => {
  fetch('http://127.0.0.1:PORT/log', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({hypothesis:'H1', message:'Component rendered', data:{props: JSON.parse(JSON.stringify(props))}})}).catch(()=>{});
});
// #endregion DEBUG
```

**Server Component vs Client Component:**
```typescript
// Server components: use file-based logging (no fetch in RSC)
// #region DEBUG
import { appendFileSync } from 'fs';
appendFileSync('.debug/logs/debug.ndjson', JSON.stringify({hypothesis:'H1', message:'RSC render', data:{params}}) + '\n');
// #endregion DEBUG
```

### Express / NestJS

**Middleware instrumentation:**
```typescript
// #region DEBUG
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    fetch('http://127.0.0.1:PORT/log', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({hypothesis:'H1', message:'request completed', data:{method: req.method, url: req.url, status: res.statusCode, duration: Date.now() - start}})}).catch(()=>{});
  });
  next();
});
// #endregion DEBUG
```

### Django

**View instrumentation:**
```python
# #region DEBUG
import urllib.request, json, traceback
def debug_log(hypothesis, message, data=None):
    try:
        urllib.request.urlopen(urllib.request.Request(
            'http://127.0.0.1:PORT/log',
            data=json.dumps({"hypothesis": hypothesis, "message": message, "data": data or {}}).encode(),
            headers={"Content-Type": "application/json"}
        ))
    except: pass
# #endregion DEBUG
```

**ORM query logging (N+1 detection):**
```python
# #region DEBUG
from django.db import connection
queries_before = len(connection.queries)
# ... code that might cause N+1 ...
debug_log("H2", "query count", {"count": len(connection.queries) - queries_before, "queries": [q['sql'] for q in connection.queries[queries_before:]]})
# #endregion DEBUG
```

### FastAPI

**Dependency injection instrumentation:**
```python
# #region DEBUG
@app.middleware("http")
async def debug_middleware(request: Request, call_next):
    import time
    start = time.time()
    response = await call_next(request)
    debug_log("H1", "request", {"path": str(request.url), "status": response.status_code, "duration_ms": (time.time() - start) * 1000})
    return response
# #endregion DEBUG
```

### Go (Gin / Echo / Chi)

**Middleware instrumentation:**
```go
// #region DEBUG
func debugMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        c.Next()
        b, _ := json.Marshal(map[string]interface{}{
            "hypothesis": "H1",
            "message":    "request",
            "data": map[string]interface{}{
                "path":     c.Request.URL.Path,
                "status":   c.Writer.Status(),
                "duration": time.Since(start).Milliseconds(),
            },
        })
        http.Post(fmt.Sprintf("http://127.0.0.1:%d/log", PORT), "application/json", bytes.NewReader(b))
    }
}
// #endregion DEBUG
```

**Goroutine leak detection:**
```go
// #region DEBUG
func() {
    b, _ := json.Marshal(map[string]interface{}{
        "hypothesis": "H3",
        "message":    "goroutine count",
        "data":       map[string]interface{}{"count": runtime.NumGoroutine()},
    })
    http.Post(fmt.Sprintf("http://127.0.0.1:%d/log", PORT), "application/json", bytes.NewReader(b))
}()
// #endregion DEBUG
```

### Rails

**Controller instrumentation:**
```ruby
# #region DEBUG
around_action :debug_log_action

def debug_log_action
  start = Time.now
  yield
  require 'net/http'; require 'json'
  Net::HTTP.post(URI("http://127.0.0.1:PORT/log"),
    {hypothesis: 'H1', message: 'action', data: {controller: controller_name, action: action_name, params: params.to_unsafe_h, duration: ((Time.now - start) * 1000).round}}.to_json,
    'Content-Type' => 'application/json') rescue nil
end
# #endregion DEBUG
```

### Laravel

**Middleware instrumentation:**
```php
// #region DEBUG
public function handle($request, Closure $next) {
    $start = microtime(true);
    $response = $next($request);
    file_get_contents('http://127.0.0.1:PORT/log', false, stream_context_create(['http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => json_encode([
            'hypothesis' => 'H1',
            'message' => 'request',
            'data' => ['path' => $request->path(), 'status' => $response->getStatusCode(), 'duration_ms' => (microtime(true) - $start) * 1000]
        ])
    ]]));
    return $response;
}
// #endregion DEBUG
```

### Flutter

**Widget rebuild tracking:**
```dart
// #region DEBUG
@override
Widget build(BuildContext context) {
  http.post(Uri.parse('http://127.0.0.1:PORT/log'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'hypothesis': 'H1', 'message': 'widget rebuild', 'data': {'widget': runtimeType.toString()}}));
  // ... original build
}
// #endregion DEBUG
```

### Spring Boot

**Aspect-oriented instrumentation:**
```java
// #region DEBUG
@Around("execution(* com.example.controller.*.*(..))")
public Object debugLog(ProceedingJoinPoint jp) throws Throwable {
    long start = System.currentTimeMillis();
    Object result = jp.proceed();
    new Thread(() -> {
        try {
            var conn = (HttpURLConnection) new URL("http://127.0.0.1:PORT/log").openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            conn.getOutputStream().write(("{\"hypothesis\":\"H1\",\"message\":\"method call\",\"data\":{\"method\":\"" + jp.getSignature().getName() + "\",\"duration\":" + (System.currentTimeMillis() - start) + "}}").getBytes());
            conn.getResponseCode();
        } catch (Exception e) {}
    }).start();
    return result;
}
// #endregion DEBUG
```

## Region Marker Reference

| Language | Start | End |
|----------|-------|-----|
| JavaScript, TypeScript, Go, Rust, Java, Kotlin, C#, PHP, Dart, C, C++ | `// #region DEBUG` | `// #endregion DEBUG` |
| Python, Ruby, Shell, YAML, Elixir | `# #region DEBUG` | `# #endregion DEBUG` |
| HTML, Vue (template), Svelte (template) | `<!-- #region DEBUG -->` | `<!-- #endregion DEBUG -->` |
| SQL, Lua | `-- #region DEBUG` | `-- #endregion DEBUG` |
