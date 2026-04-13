interface LogTemplate {
  language: string;
  httpSnippet: (port: number, hypothesis: string) => string;
  fileSnippet: (logFile: string, hypothesis: string) => string;
  regionStart: string;
  regionEnd: string;
}

const templates: Record<string, LogTemplate> = {
  javascript: {
    language: "javascript",
    httpSnippet: (port, hypothesis) =>
      `fetch('http://127.0.0.1:${port}/log', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({hypothesis:'${hypothesis}', message:'DESCRIPTION', data:{VAR_NAME: VAR_VALUE}})}).catch(()=>{});`,
    fileSnippet: (logFile, hypothesis) =>
      `require('fs').appendFileSync('${logFile}', JSON.stringify({hypothesis:'${hypothesis}', message:'DESCRIPTION', data:{VAR_NAME: VAR_VALUE}, timestamp:new Date().toISOString()})+'\\n');`,
    regionStart: "// #region DEBUG",
    regionEnd: "// #endregion DEBUG",
  },
  typescript: {
    language: "typescript",
    httpSnippet: (port, hypothesis) =>
      `fetch('http://127.0.0.1:${port}/log', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({hypothesis:'${hypothesis}', message:'DESCRIPTION', data:{VAR_NAME: VAR_VALUE}})}).catch(()=>{});`,
    fileSnippet: (logFile, hypothesis) =>
      `import { appendFileSync } from 'fs'; appendFileSync('${logFile}', JSON.stringify({hypothesis:'${hypothesis}', message:'DESCRIPTION', data:{VAR_NAME: VAR_VALUE}, timestamp:new Date().toISOString()})+'\\n');`,
    regionStart: "// #region DEBUG",
    regionEnd: "// #endregion DEBUG",
  },
  python: {
    language: "python",
    httpSnippet: (port, hypothesis) =>
      `import urllib.request, json; urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:${port}/log', data=json.dumps({"hypothesis": "${hypothesis}", "message": "DESCRIPTION", "data": {"VAR_NAME": VAR_VALUE}}).encode(), headers={"Content-Type": "application/json"}))  # noqa`,
    fileSnippet: (logFile, hypothesis) =>
      `import json, datetime; open('${logFile}', 'a').write(json.dumps({"hypothesis": "${hypothesis}", "message": "DESCRIPTION", "data": {"VAR_NAME": "VAR_VALUE"}, "timestamp": datetime.datetime.now().isoformat()}) + '\\n')  # noqa`,
    regionStart: "# #region DEBUG",
    regionEnd: "# #endregion DEBUG",
  },
  go: {
    language: "go",
    httpSnippet: (port, hypothesis) =>
      `func() { b, _ := json.Marshal(map[string]interface{}{"hypothesis": "${hypothesis}", "message": "DESCRIPTION", "data": map[string]interface{}{"VAR_NAME": VAR_VALUE}}); http.Post("http://127.0.0.1:${port}/log", "application/json", bytes.NewReader(b)) }()`,
    fileSnippet: (logFile, hypothesis) =>
      `func() { b, _ := json.Marshal(map[string]interface{}{"hypothesis": "${hypothesis}", "message": "DESCRIPTION", "data": map[string]interface{}{"VAR_NAME": VAR_VALUE}, "timestamp": time.Now().Format(time.RFC3339)}); f, _ := os.OpenFile("${logFile}", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); f.Write(append(b, '\\n')); f.Close() }()`,
    regionStart: "// #region DEBUG",
    regionEnd: "// #endregion DEBUG",
  },
  rust: {
    language: "rust",
    httpSnippet: (port, hypothesis) =>
      `// Use reqwest or ureq in Cargo.toml, or std::net::TcpStream for zero-dep:\nstd::thread::spawn(move || { let _ = ureq::post(&format!("http://127.0.0.1:${port}/log")).send_json(ureq::json!({"hypothesis": "${hypothesis}", "message": "DESCRIPTION", "data": {"VAR_NAME": format!("{:?}", VAR_VALUE)}})); });`,
    fileSnippet: (logFile, hypothesis) =>
      `{ use std::io::Write; let mut f = std::fs::OpenOptions::new().append(true).create(true).open("${logFile}").unwrap(); writeln!(f, r#"{{"hypothesis":"${hypothesis}","message":"DESCRIPTION","data":{{"VAR_NAME":"{:?}"}}}}"#, VAR_VALUE).unwrap(); }`,
    regionStart: "// #region DEBUG",
    regionEnd: "// #endregion DEBUG",
  },
  ruby: {
    language: "ruby",
    httpSnippet: (port, hypothesis) =>
      `require 'net/http'; require 'json'; Net::HTTP.post(URI("http://127.0.0.1:${port}/log"), {hypothesis: '${hypothesis}', message: 'DESCRIPTION', data: {VAR_NAME: VAR_VALUE}}.to_json, 'Content-Type' => 'application/json') rescue nil`,
    fileSnippet: (logFile, hypothesis) =>
      `File.open('${logFile}', 'a') { |f| f.puts({hypothesis: '${hypothesis}', message: 'DESCRIPTION', data: {VAR_NAME: VAR_VALUE}, timestamp: Time.now.iso8601}.to_json) }`,
    regionStart: "# #region DEBUG",
    regionEnd: "# #endregion DEBUG",
  },
  php: {
    language: "php",
    httpSnippet: (port, hypothesis) =>
      `file_get_contents('http://127.0.0.1:${port}/log', false, stream_context_create(['http' => ['method' => 'POST', 'header' => 'Content-Type: application/json', 'content' => json_encode(['hypothesis' => '${hypothesis}', 'message' => 'DESCRIPTION', 'data' => ['VAR_NAME' => $VAR_VALUE]])]]));`,
    fileSnippet: (logFile, hypothesis) =>
      `file_put_contents('${logFile}', json_encode(['hypothesis' => '${hypothesis}', 'message' => 'DESCRIPTION', 'data' => ['VAR_NAME' => $VAR_VALUE], 'timestamp' => date('c')]) . "\\n", FILE_APPEND);`,
    regionStart: "// #region DEBUG",
    regionEnd: "// #endregion DEBUG",
  },
  java: {
    language: "java",
    httpSnippet: (port, hypothesis) =>
      `new Thread(() -> { try { var conn = (java.net.HttpURLConnection) new java.net.URL("http://127.0.0.1:${port}/log").openConnection(); conn.setRequestMethod("POST"); conn.setRequestProperty("Content-Type", "application/json"); conn.setDoOutput(true); conn.getOutputStream().write(("{\\"hypothesis\\":\\"${hypothesis}\\",\\"message\\":\\"DESCRIPTION\\",\\"data\\":{\\"VAR_NAME\\":\\"" + VAR_VALUE + "\\"}}").getBytes()); conn.getResponseCode(); } catch (Exception e) {} }).start();`,
    fileSnippet: (logFile, hypothesis) =>
      `try (var fw = new java.io.FileWriter("${logFile}", true)) { fw.write("{\\"hypothesis\\":\\"${hypothesis}\\",\\"message\\":\\"DESCRIPTION\\",\\"data\\":{\\"VAR_NAME\\":\\"" + VAR_VALUE + "\\"},\\"timestamp\\":\\"" + java.time.Instant.now() + "\\"}\\n"); } catch (Exception e) {}`,
    regionStart: "// #region DEBUG",
    regionEnd: "// #endregion DEBUG",
  },
  kotlin: {
    language: "kotlin",
    httpSnippet: (port, hypothesis) =>
      `Thread { try { val conn = java.net.URL("http://127.0.0.1:${port}/log").openConnection() as java.net.HttpURLConnection; conn.requestMethod = "POST"; conn.setRequestProperty("Content-Type", "application/json"); conn.doOutput = true; conn.outputStream.write("""{"hypothesis":"${hypothesis}","message":"DESCRIPTION","data":{"VAR_NAME":"$VAR_VALUE"}}""".toByteArray()); conn.responseCode } catch (_: Exception) {} }.start()`,
    fileSnippet: (logFile, hypothesis) =>
      `java.io.File("${logFile}").appendText("""{"hypothesis":"${hypothesis}","message":"DESCRIPTION","data":{"VAR_NAME":"$VAR_VALUE"},"timestamp":"${"$"}{java.time.Instant.now()}"}""" + "\\n")`,
    regionStart: "// #region DEBUG",
    regionEnd: "// #endregion DEBUG",
  },
  dart: {
    language: "dart",
    httpSnippet: (port, hypothesis) =>
      `import 'dart:convert'; import 'package:http/http.dart' as http; http.post(Uri.parse('http://127.0.0.1:${port}/log'), headers: {'Content-Type': 'application/json'}, body: jsonEncode({'hypothesis': '${hypothesis}', 'message': 'DESCRIPTION', 'data': {'VAR_NAME': VAR_VALUE}}));`,
    fileSnippet: (logFile, hypothesis) =>
      `import 'dart:io'; import 'dart:convert'; File('${logFile}').writeAsStringSync(jsonEncode({'hypothesis': '${hypothesis}', 'message': 'DESCRIPTION', 'data': {'VAR_NAME': VAR_VALUE.toString()}, 'timestamp': DateTime.now().toIso8601String()}) + '\\n', mode: FileMode.append);`,
    regionStart: "// #region DEBUG",
    regionEnd: "// #endregion DEBUG",
  },
  csharp: {
    language: "csharp",
    httpSnippet: (port, hypothesis) =>
      `_ = Task.Run(async () => { using var client = new HttpClient(); await client.PostAsync("http://127.0.0.1:${port}/log", new StringContent(System.Text.Json.JsonSerializer.Serialize(new { hypothesis = "${hypothesis}", message = "DESCRIPTION", data = new { VAR_NAME = VAR_VALUE } }), System.Text.Encoding.UTF8, "application/json")); });`,
    fileSnippet: (logFile, hypothesis) =>
      `System.IO.File.AppendAllText("${logFile}", System.Text.Json.JsonSerializer.Serialize(new { hypothesis = "${hypothesis}", message = "DESCRIPTION", data = new { VAR_NAME = VAR_VALUE }, timestamp = DateTime.UtcNow.ToString("o") }) + "\\n");`,
    regionStart: "// #region DEBUG",
    regionEnd: "// #endregion DEBUG",
  },
  elixir: {
    language: "elixir",
    httpSnippet: (port, hypothesis) =>
      `:httpc.request(:post, {~c"http://127.0.0.1:${port}/log", [], ~c"application/json", Jason.encode!(%{hypothesis: "${hypothesis}", message: "DESCRIPTION", data: %{VAR_NAME: inspect(VAR_VALUE)}})}, [], [])`,
    fileSnippet: (logFile, hypothesis) =>
      `File.write!("${logFile}", Jason.encode!(%{hypothesis: "${hypothesis}", message: "DESCRIPTION", data: %{VAR_NAME: inspect(VAR_VALUE)}, timestamp: DateTime.utc_now() |> DateTime.to_iso8601()}) <> "\\n", [:append])`,
    regionStart: "# #region DEBUG",
    regionEnd: "# #endregion DEBUG",
  },
  shell: {
    language: "shell",
    httpSnippet: (port, hypothesis) =>
      `curl -s -X POST http://127.0.0.1:${port}/log -H 'Content-Type: application/json' -d '{"hypothesis":"${hypothesis}","message":"DESCRIPTION","data":{"VAR_NAME":"'"$VAR_VALUE"'"}}' &>/dev/null &`,
    fileSnippet: (logFile, hypothesis) =>
      `echo '{"hypothesis":"${hypothesis}","message":"DESCRIPTION","data":{"VAR_NAME":"'"$VAR_VALUE"'"},"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> '${logFile}'`,
    regionStart: "# #region DEBUG",
    regionEnd: "# #endregion DEBUG",
  },
};

// Alias some languages
templates.vue = { ...templates.javascript, language: "vue" };
templates.svelte = { ...templates.javascript, language: "svelte" };
templates.jsx = templates.javascript;
templates.tsx = templates.typescript;
templates.fsharp = { ...templates.csharp, language: "fsharp" };
templates.scala = { ...templates.java, language: "scala" };

export interface LogTemplateResult {
  language: string;
  httpSnippet: string | null;
  fileSnippet: string;
  regionStart: string;
  regionEnd: string;
  note: string;
}

export function getLogTemplates(
  language: string,
  port: number | null,
  logFile: string,
  hypothesis: string
): LogTemplateResult {
  const lang = language.toLowerCase();
  const template = templates[lang];

  if (!template) {
    return {
      language: lang,
      httpSnippet: port
        ? `# Use your language's HTTP library to POST JSON to http://127.0.0.1:${port}/log\n# Body: {"hypothesis":"${hypothesis}","message":"DESCRIPTION","data":{"VAR_NAME":"VAR_VALUE"}}`
        : null,
      fileSnippet: `# Append NDJSON to ${logFile}\n# Format: {"hypothesis":"${hypothesis}","message":"DESCRIPTION","data":{"VAR_NAME":"VAR_VALUE"},"timestamp":"ISO8601"}`,
      regionStart: "// #region DEBUG",
      regionEnd: "// #endregion DEBUG",
      note: `No built-in template for ${lang}. Use any HTTP POST or file-append method.`,
    };
  }

  return {
    language: lang,
    httpSnippet: port ? template.httpSnippet(port, hypothesis) : null,
    fileSnippet: template.fileSnippet(logFile, hypothesis),
    regionStart: template.regionStart,
    regionEnd: template.regionEnd,
    note: port
      ? "HTTP logging preferred (structured, real-time). File logging as fallback."
      : "Log server unavailable. Using file-based logging.",
  };
}
