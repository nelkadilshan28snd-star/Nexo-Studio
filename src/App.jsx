import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RotateCcw, Moon, Sun, Download, Trash2, CheckCircle2, XCircle, AlertCircle, Eye, FileText } from 'lucide-react';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
  const [csvData, setCsvData] = useState('id,name\n1,Alice\n2,Bob\n3,Charlie');
  
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  const abortControllerRef = useRef(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('nexo_bulk_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {}
    }
  }, []);

  const saveHistoryToStorage = (newHistory) => {
    setHistory(newHistory);
    localStorage.setItem('nexo_bulk_history', JSON.stringify(newHistory));
  };

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headersList = lines[0].split(',').map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i].split(',').map(val => val.trim());
      const obj = {};
      headersList.forEach((header, index) => {
        obj[header] = currentLine[index] !== undefined ? currentLine[index] : '';
      });
      rows.push(obj);
    }
    return rows;
  };

  const interpolate = (template, data) => {
    let result = template;
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, data[key]);
    });
    return result;
  };

  const executeRow = async (row, parsedHeaders, endpointUrl, methodType) => {
    const startTime = performance.now();
    try {
      const finalUrl = interpolate(endpointUrl, row);
      let parsedHeadersObj = {};
      try {
        parsedHeadersObj = JSON.parse(interpolate(headers, row));
      } catch (e) {}

      const options = {
        method: methodType,
        headers: parsedHeadersObj,
      };

      if (['POST', 'PUT', 'PATCH'].includes(methodType)) {
        options.body = JSON.stringify(row);
      }

      const response = await fetch(finalUrl, options);
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);
      
      let responseBody;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      return {
        row,
        status: response.status,
        ok: response.ok,
        responseTime,
        requestDetails: { url: finalUrl, method: methodType, headers: parsedHeadersObj, payload: row },
        responseBody: typeof responseBody === 'object' ? JSON.stringify(responseBody, null, 2) : responseBody
      };
    } catch (err) {
      const endTime = performance.now();
      return {
        row,
        status: 0,
        ok: false,
        responseTime: Math.round(endTime - startTime),
        requestDetails: { url: endpointUrl, method: methodType, row },
        responseBody: err.message || 'Network Error'
      };
    }
  };

  const handleStartBulkRun = async () => {
    const rows = parseCSV(csvData);
    if (rows.length === 0) {
      alert('Please provide valid CSV data with headers.');
      return;
    }
    if (!url) {
      alert('Please enter a target URL.');
      return;
    }

    setIsRunning(true);
    setProgress({ current: 0, total: rows.length });
    setResults([]);
    
    abortControllerRef.current = new AbortController();
    let parsedHeaders = {};
    try {
      parsedHeaders = JSON.parse(headers);
    } catch (e) {}

    const newResults = [];
    for (let i = 0; i < rows.length; i++) {
      if (abortControllerRef.current?.signal.aborted) break;

      setProgress({ current: i + 1, total: rows.length });
      const res = await executeRow(rows[i], parsedHeaders, url, method);
      newResults.push(res);
      setResults([...newResults]);
    }

    setIsRunning(false);

    const batchSummary = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      url,
      method,
      total: rows.length,
      passed: newResults.filter(r => r.ok).length,
      failed: newResults.filter(r => !r.ok).length,
      results: newResults
    };
    saveHistoryToStorage([batchSummary, ...history]);
  };

  const handleStopBulkRun = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
  };

  const handleRetrySingle = async (item, index) => {
    let parsedHeaders = {};
    try {
      parsedHeaders = JSON.parse(headers);
    } catch (e) {}

    const res = await executeRow(item.row, parsedHeaders, url, method);
    const updatedResults = [...results];
    updatedResults[index] = res;
    setResults(updatedResults);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
      color: isDarkMode ? '#f8fafc' : '#0f172a',
      fontFamily: 'Inter, system-ui, sans-serif',
      transition: 'background-color 0.3s ease, color 0.3s ease'
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 32px',
        borderBottom: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '45px',
            height: '45px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <img src="/logos.png" alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: '900', fontSize: '18px', letterSpacing: '1px', lineHeight: '1.2' }}>
              NEXO <span style={{ color: '#06b6d4' }}>STUDIO</span>
            </span>
            <span style={{ fontSize: '11px', fontWeight: '600', color: isDarkMode ? '#94a3b8' : '#64748b', letterSpacing: '0.5px' }}>
              DEVELOPED BY NEXO DEV FOR FLI TEAM • FINANCE
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          style={{
            background: isDarkMode ? '#334155' : '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: isDarkMode ? '#f8fafc' : '#0f172a',
            transition: 'transform 0.2s ease'
          }}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      {/* Main Workspace */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '24px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px'
      }}>
        {/* Left Column: Request Configuration & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Config Card */}
          <div style={{
            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', marginTop: 0 }}>API Request Configuration</h2>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                  backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                  color: isDarkMode ? '#f8fafc' : '#0f172a',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>

              <input
                type="text"
                placeholder="https://api.example.com/users/{{id}}"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                  backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                  color: isDarkMode ? '#f8fafc' : '#0f172a',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>Headers (JSON)</label>
                <textarea
                  value={headers}
                  onChange={(e) => setHeaders(e.target.value)}
                  rows={5}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                    color: isDarkMode ? '#f8fafc' : '#0f172a',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>CSV Data Input</label>
                <textarea
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  rows={5}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                    color: isDarkMode ? '#f8fafc' : '#0f172a',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Execution Controls: Start or Stop */}
            {!isRunning ? (
              <button
                onClick={handleStartBulkRun}
                style={{
                  width: '100%',
                  backgroundColor: '#06b6d4',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
                }}
              >
                <Play size={18} /> Start Bulk Execution
              </button>
            ) : (
              <button
                onClick={handleStopBulkRun}
                style={{
                  width: '100%',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}
              >
                <Square size={18} /> Stop Execution ({progress.current}/{progress.total})
              </button>
            )}
          </div>

          {/* History Card */}
          <div style={{
            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px', marginTop: 0 }}>Execution History</h3>
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.length === 0 ? (
                <p style={{ fontSize: '13px', color: isDarkMode ? '#94a3b8' : '#64748b', margin: 0 }}>No past executions found.</p>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => { setResults(item.results); setUrl(item.url); setMethod(item.method); }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                      border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{item.method} {item.url}</div>
                      <div style={{ fontSize: '11px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>{item.timestamp} • Total: {item.total}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ {item.passed}</span>
                      <span style={{ color: '#ef4444', fontWeight: 'bold' }}>✕ {item.failed}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Live Results Panel */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            height: '560px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Live Execution Results</h2>
              {results.length > 0 && (
                <span style={{ fontSize: '12px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Total Processed: {results.length}
                </span>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {results.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  <FileText size={48} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p style={{ margin: 0, fontSize: '14px' }}>Run a bulk dataset to view live responses here.</p>
                </div>
              ) : (
                results.map((res, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                      border: `1px solid ${res.ok ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                      {res.ok ? <CheckCircle2 color="#10b981" size={20} /> : <XCircle color="#ef4444" size={20} />}
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Row {index + 1}: {JSON.stringify(res.row)}
                        </div>
                        <div style={{ fontSize: '11px', color: isDarkMode ? '#94a3b8' : '#64748b', display: 'flex', gap: '12px' }}>
                          <span>Status: <strong style={{ color: res.ok ? '#10b981' : '#ef4444' }}>{res.status}</strong></span>
                          <span>Time: {res.responseTime}ms</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {/* Postman-style Preview Button */}
                      <button
                        onClick={() => setSelectedItem(res)}
                        style={{
                          background: 'none',
                          border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                          padding: '6px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: isDarkMode ? '#f8fafc' : '#0f172a',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Eye size={14} /> Preview
                      </button>

                      {/* Retry Button for Failed Iterations */}
                      {!res.ok && (
                        <button
                          onClick={() => handleRetrySingle(res, index)}
                          style={{
                            backgroundColor: '#06b6d4',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#ffffff',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 'bold'
                          }}
                        >
                          <RotateCcw size={14} /> Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Postman-Style Request / Response Inspector Modal */}
      {selectedItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Postman-style Request / Response Inspector</h3>
              <button
                onClick={() => setSelectedItem(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>REQUEST DETAILS</h4>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', fontSize: '12px', fontFamily: 'monospace' }}>
                  <div><strong>URL:</strong> {selectedItem.requestDetails?.url}</div>
                  <div><strong>Method:</strong> {selectedItem.requestDetails?.method}</div>
                  <div style={{ marginTop: '6px' }}><strong>Payload / Iteration Data:</strong></div>
                  <pre style={{ margin: '4px 0 0 0' }}>{JSON.stringify(selectedItem.row, null, 2)}</pre>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>RESPONSE DETAILS</h4>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', fontSize: '12px', fontFamily: 'monospace' }}>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                    <span>Status Code: <strong style={{ color: selectedItem.ok ? '#10b981' : '#ef4444' }}>{selectedItem.status}</strong></span>
                    <span>Response Time: {selectedItem.responseTime}ms</span>
                  </div>
                  <div><strong>Response Body:</strong></div>
                  <pre style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{selectedItem.responseBody}</pre>
                </div>
              </div>
            </div>

            <div style={{
              padding: '16px 20px',
              borderTop: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setSelectedItem(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#06b6d4',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
