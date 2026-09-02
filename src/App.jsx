import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { 
  Send, History, ShieldAlert, Trash2, Paperclip, Play, 
  Save, Settings, Download, Upload, Cpu, Moon, Sun, FileText
} from 'lucide-react';

function App() {
  // --- Theme State ---
  const [isDarkMode, setIsDarkMode] = useState(true);

  // --- Core States ---
  const [method, setMethod] = useState('POST');
  const [url, setUrl] = useState('https://fineract.fli.lk/fineract-provider/api/v1/journalentries');
  const [activeTab, setActiveTab] = useState('body');
  const [useProxy, setUseProxy] = useState(false);

  // --- Grids & Inputs ---
  const [params, setParams] = useState([{ key: '', value: '', enabled: true }]);
  const [headersList, setHeadersList] = useState([
    { key: 'Content-Type', value: 'application/json', enabled: true },
    { key: 'Accept', value: 'application/json', enabled: true },
    { key: 'Fineract-Platform-TenantId', value: 'default', enabled: true }
  ]);

  const [authType, setAuthType] = useState('none');
  const [bearerToken, setBearerToken] = useState('');
  const [basicAuth, setBasicAuth] = useState({ username: '', password: '' });

  // Fixed Default Body format with proper JSON data types for Fineract API
  const [bodyType, setBodyType] = useState('raw-json');
  const [rawBody, setRawBody] = useState(`{\n  "locale": "en",\n  "dateFormat": "yyyy-MM-dd",\n  "officeId": 1,\n  "transactionDate": "2026-08-24",\n  "comments": "Test Post",\n  "currencyCode": "LKR",\n  "credits": [{"glAccountId": 1, "amount": 100.00}],\n  "debits": [{"glAccountId": 2, "amount": 100.00}]\n}`);

  // --- Envs & Storage ---
  const [envVars, setEnvVars] = useState([{ key: 'base_url', value: 'https://fineract.fli.lk', enabled: true }]);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [collections, setCollections] = useState([]);
  const [activeReqId, setActiveReqId] = useState(null);
  const [history, setHistory] = useState([]);
  
  // --- Bulk Run History State ---
  const [bulkHistory, setBulkHistory] = useState([]);

  // --- Bulk Runner ---
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkData, setBulkData] = useState([]);
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [currentBulkName, setCurrentBulkName] = useState('');

  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load Saved Data safely
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('nexo_history_pro');
      const savedCollections = localStorage.getItem('nexo_collections');
      const savedEnvs = localStorage.getItem('nexo_envs');
      const savedBulkHistory = localStorage.getItem('nexo_bulk_history');
      const savedTheme = localStorage.getItem('nexo_theme');
      
      if (savedHistory) setHistory(JSON.parse(savedHistory));
      if (savedCollections) setCollections(JSON.parse(savedCollections));
      if (savedEnvs) setEnvVars(JSON.parse(savedEnvs));
      if (savedBulkHistory) setBulkHistory(JSON.parse(savedBulkHistory));
      if (savedTheme !== null) setIsDarkMode(savedTheme === 'dark');
    } catch (e) {
      console.error("Local storage load error:", e);
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    try { localStorage.setItem('nexo_theme', newMode ? 'dark' : 'light'); } catch (e) {}
  };

  const saveEnvs = (updated) => {
    setEnvVars(updated);
    try { localStorage.setItem('nexo_envs', JSON.stringify(updated)); } catch (e) {}
  };

  const replaceVariables = (str, rowData = {}) => {
    if (!str) return '';
    let result = str;
    Object.keys(rowData).forEach(key => {
      const val = rowData[key] !== undefined && rowData[key] !== null ? rowData[key].toString().trim() : '';
      const isNumOrBool = (!isNaN(val) && val !== '') || val === 'true' || val === 'false';
      if (isNumOrBool) result = result.replace(new RegExp(`"\\s*{{\\s*${key}\\s*}}\\s*"`, 'g'), val);
      result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), val);
    });
    envVars.forEach(env => {
      if (env.enabled && env.key) result = result.replace(new RegExp(`{{\\s*${env.key}\\s*}}`, 'g'), env.value);
    });
    return result;
  };

  const updateKV = (list, setList, idx, field, val) => {
    const updated = [...list];
    updated[idx][field] = val;
    setList(updated);
  };
  const addKV = (list, setList) => setList([...list, { key: '', value: '', enabled: true }]);
  const removeKV = (list, setList, idx) => setList(list.filter((_, i) => i !== idx));

  // Save to Collections
  const saveToCollection = () => {
    const name = window.prompt("Enter Request Name:", activeReqId ? collections.find(c => c.id === activeReqId)?.name : "New Request");
    if (!name) return;
    const reqData = { id: activeReqId || Date.now().toString(), name, method, url, params, headersList, authType, bearerToken, basicAuth, bodyType, rawBody };
    let updated;
    if (activeReqId && collections.some(c => c.id === activeReqId)) updated = collections.map(c => c.id === activeReqId ? reqData : c);
    else { updated = [reqData, ...collections]; setActiveReqId(reqData.id); }
    setCollections(updated);
    try { localStorage.setItem('nexo_collections', JSON.stringify(updated)); } catch (e) {}
  };

  const loadCollectionItem = (item) => {
    setActiveReqId(item.id);
    setMethod(item.method || 'GET');
    setUrl(item.url || '');
    setParams(item.params || []);
    setHeadersList(item.headersList || []);
    setAuthType(item.authType || 'none');
    setBearerToken(item.bearerToken || '');
    setBasicAuth(item.basicAuth || { username: '', password: '' });
    setBodyType(item.bodyType || 'none');
    setRawBody(item.rawBody || '');
    setBulkMode(false);
  };

  const deleteCollectionItem = (id, e) => {
    e.stopPropagation();
    const updated = collections.filter(c => c.id !== id);
    setCollections(updated);
    try { localStorage.setItem('nexo_collections', JSON.stringify(updated)); } catch (e) {}
    if (activeReqId === id) setActiveReqId(null);
  };

  const exportCollectionJSON = () => {
    if (collections.length === 0) return alert("No saved collections to export!");
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(collections, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Nexo_Collections_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor); downloadAnchor.click(); downloadAnchor.remove();
  };

  // Import Collection JSON
  const importCollectionJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (Array.isArray(importedData)) {
          const merged = [...importedData, ...collections.filter(c => !importedData.some(i => i.id === c.id))];
          setCollections(merged);
          try { localStorage.setItem('nexo_collections', JSON.stringify(merged)); } catch (err) {}
          alert("Collections imported successfully!");
        } else {
          alert("Invalid collection format!");
        }
      } catch (err) {
        alert("Error parsing JSON file!");
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCurrentBulkName(file.name);
      Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => {
        setBulkData(results.data); setBulkResults([]); setSelectedResult(null); setBulkMode(true);
      }});
    }
  };

  // Request Execution
  const executeSingleRequest = async (overrideRowData = null) => {
    const row = overrideRowData || {};
    let finalUrl = replaceVariables(url, row);
    const queryParts = params.filter(p => p.enabled && p.key).map(p => `${encodeURIComponent(replaceVariables(p.key, row))}=${encodeURIComponent(replaceVariables(p.value, row))}`);
    if (queryParts.length > 0) finalUrl += (finalUrl.includes('?') ? '&' : '?') + queryParts.join('&');

    let finalHeaders = {};
    headersList.forEach(h => { if (h.enabled && h.key) finalHeaders[replaceVariables(h.key, row)] = replaceVariables(h.value, row); });

    if (authType === 'bearer' && bearerToken) finalHeaders['Authorization'] = `Bearer ${replaceVariables(bearerToken, row)}`;
    else if (authType === 'basic') {
      try {
        finalHeaders['Authorization'] = `Basic ${btoa(`${replaceVariables(basicAuth.username, row)}:${replaceVariables(basicAuth.password, row)}`)}`;
      } catch (err) {}
    }

    let finalData = null;
    if (['POST', 'PUT', 'PATCH'].includes(method) && bodyType === 'raw-json') {
      const processedStr = replaceVariables(rawBody, row);
      try { 
        finalData = JSON.parse(processedStr); 
      } catch (e) { 
        finalData = processedStr; 
      }
    }

    const targetUrl = useProxy ? `https://corsproxy.io/?${encodeURIComponent(finalUrl)}` : finalUrl;
    const startTime = Date.now();
    try {
      const res = await axios({ method, url: targetUrl, headers: finalHeaders, data: finalData });
      return { 
        success: true, 
        status: res.status, 
        statusText: res.statusText || 'OK', 
        time: `${Date.now() - startTime} ms`, 
        url: finalUrl, 
        sentBody: finalData, 
        data: res.data !== undefined ? res.data : "Success (No Content)" 
      };
    } catch (err) {
      return { 
        success: false, 
        status: err.response?.status || 'Error', 
        statusText: err.message || 'Request Failed', 
        time: `${Date.now() - startTime} ms`, 
        url: finalUrl, 
        sentBody: finalData, 
        data: err.response?.data || { error: err.message || "Network Error / Connection Failed" } 
      };
    }
  };

  const handleSend = async () => {
    setLoading(true); setResponse(null);
    const res = await executeSingleRequest();
    setResponse(res); setLoading(false);
    const now = new Date();
    const historyItem = { id: Date.now().toString(), method, url, date: now.toLocaleDateString(), time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: res.status, success: res.success };
    const updated = [historyItem, ...history].slice(0, 100);
    setHistory(updated); 
    try { localStorage.setItem('nexo_history_pro', JSON.stringify(updated)); } catch (e) {}
  };

  const runBulkCollection = async () => {
    setBulkRunning(true); setBulkResults([]); setSelectedResult(null);
    let resultsList = [];
    for (let i = 0; i < bulkData.length; i++) {
      const res = await executeSingleRequest(bulkData[i]);
      resultsList.push({ index: i + 1, row: bulkData[i], ...res });
      setBulkResults([...resultsList]);
    }
    setBulkRunning(false);

    // Save Bulk Run Job to LocalStorage History
    const now = new Date();
    const passedCount = resultsList.filter(r => r.success).length;
    const failedCount = resultsList.length - passedCount;
    const bulkJobItem = {
      id: Date.now().toString(),
      name: currentBulkName || 'Batch Run',
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      total: bulkData.length,
      passed: passedCount,
      failed: failedCount,
      results: resultsList
    };
    const updatedBulkHistory = [bulkJobItem, ...bulkHistory].slice(0, 50);
    setBulkHistory(updatedBulkHistory);
    try { localStorage.setItem('nexo_bulk_history', JSON.stringify(updatedBulkHistory)); } catch (e) {}
  };

  const loadBulkHistoryItem = (job) => {
    setCurrentBulkName(job.name);
    setBulkResults(job.results);
    setBulkData(job.results.map(r => r.row));
    setBulkMode(true);
    setSelectedResult(null);
  };

  const downloadExcelReport = () => {
    if (bulkResults.length === 0) return;
    const reportData = bulkResults.map(item => ({
      "Row #": item.index, "Status": item.success ? 'PASSED' : 'FAILED', "Status Code": item.status, "Time": item.time, "URL": item.url, "Payload": JSON.stringify(item.data)
    }));
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `Nexo_Report_${Date.now()}.xlsx`);
  };

  // --- Dynamic Theme Styles ---
  const theme = {
    bgGradient: isDarkMode ? 'radial-gradient(circle at top left, #0b1121, #020617)' : 'radial-gradient(circle at top left, #f8fafc, #e2e8f0)',
    panelBg: isDarkMode ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    panelBorder: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.1)',
    textColor: isDarkMode ? '#e2e8f0' : '#1e293b',
    subTextColor: isDarkMode ? '#94a3b8' : '#64748b',
    inputBg: isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.9)',
    inputBorder: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.15)',
    inputColor: isDarkMode ? '#fff' : '#0f172a',
    tabActive: '#06b6d4',
  };

  const glassPanel = { background: theme.panelBg, backdropFilter: 'blur(12px)', border: theme.panelBorder, borderRadius: '12px' };
  const inputStyle = { width: '100%', background: theme.inputBg, color: theme.inputColor, border: theme.inputBorder, padding: '6px 10px', borderRadius: '6px', outline: 'none', fontSize: '11px' };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: theme.bgGradient, color: theme.textColor, fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden', position: 'fixed', top: 0, left: 0, boxSizing: 'border-box' }}>
      
      <style>{`
        * { box-sizing: border-box; scrollbar-width: none; -ms-overflow-style: none; }
        *::-webkit-scrollbar { display: none; }
        body, html { margin: 0; padding: 0; overflow: hidden; height: 100vh; width: 100vw; }
      `}</style>

      {/* SIDEBAR */}
      <div style={{ ...glassPanel, width: '300px', minWidth: '300px', margin: '12px', padding: '16px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', marginBottom: '20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div style={{ 
              width: '42px', height: '42px', 
              background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)', 
              borderRadius: '12px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(6, 182, 212, 0.4)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <img src="/logos.png" alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '900', fontSize: '16px', color: isDarkMode ? '#f8fafc' : '#0f172a', letterSpacing: '1px', lineHeight: '1.2' }}>
                NEXO <span style={{ color: '#06b6d4' }}>STUDIO</span>
              </span>
              <span style={{ fontSize: '8px', color: theme.subTextColor, letterSpacing: '0.4px', marginTop: '2px', fontWeight: '600', textTransform: 'uppercase' }}>
                Developed by Nexo Dev for FLI Team Finance
              </span>
            </div>
          </div>
          <button onClick={toggleTheme} title="Toggle Theme" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textColor }}>
            {isDarkMode ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#334155" />}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexShrink: 0 }}>
          <button onClick={() => setShowEnvModal(true)} style={{ flex: 1, background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: theme.panelBorder, color: '#06b6d4', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: '600' }}>
            <Settings size={13}/> Envs ({envVars.filter(e => e.enabled).length})
          </button>
          <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#10b981', color: '#fff', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '11px' }}>
            <Paperclip size={13} /> Run CSV
            <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '10px', fontWeight: '700', color: theme.subTextColor }}>SAVED REQUESTS</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label title="Import Collection JSON" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Upload size={13} color="#06b6d4" />
              <input type="file" accept=".json" onChange={importCollectionJSON} style={{ display: 'none' }} />
            </label>
            <Download size={13} color="#06b6d4" style={{ cursor: 'pointer' }} onClick={exportCollectionJSON} title="Export Collection JSON" />
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px', minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {collections.map(item => (
              <div key={item.id} onClick={() => loadCollectionItem(item)} style={{ padding: '8px 10px', borderRadius: '8px', background: activeReqId === item.id ? 'rgba(6, 182, 212, 0.1)' : (isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)'), border: activeReqId === item.id ? '1px solid rgba(6, 182, 212, 0.3)' : theme.panelBorder, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: activeReqId === item.id ? '#06b6d4' : theme.textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  <div style={{ fontSize: '9px', color: theme.subTextColor, marginTop: '2px' }}>{item.method} • {item.url.slice(0, 16)}...</div>
                </div>
                <Trash2 size={12} color="#ef4444" style={{ opacity: 0.7, flexShrink: 0 }} onClick={(e) => deleteCollectionItem(item.id, e)} />
              </div>
            ))}
          </div>
        </div>

        {/* BULK RUN HISTORY SECTION */}
        <div style={{ height: '120px', flexShrink: 0, borderTop: theme.panelBorder, paddingTop: '8px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: theme.subTextColor, display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={11} /> BULK HISTORY</span>
            {bulkHistory.length > 0 && <Trash2 size={11} color={theme.subTextColor} style={{ cursor: 'pointer' }} onClick={() => { setBulkHistory([]); localStorage.removeItem('nexo_bulk_history'); }} />}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {bulkHistory.map((job) => (
              <div key={job.id} onClick={() => loadBulkHistoryItem(job)} style={{ fontSize: '10px', background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: theme.panelBorder }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                  <span style={{ color: '#06b6d4', fontWeight: 'bold', marginRight: '4px' }}>{job.name}</span>
                  <span style={{ color: theme.subTextColor }}>({job.date})</span>
                </div>
                <div style={{ fontSize: '9px' }}>
                  <span style={{ color: '#10b981', marginRight: '4px' }}>{job.passed}✓</span>
                  <span style={{ color: '#ef4444' }}>{job.failed}✗</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* REQ HISTORY SECTION */}
        <div style={{ height: '120px', flexShrink: 0, borderTop: theme.panelBorder, paddingTop: '8px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: theme.subTextColor, display: 'flex', alignItems: 'center', gap: '4px' }}><History size={11} /> REQ HISTORY</span>
            {history.length > 0 && <Trash2 size={11} color={theme.subTextColor} style={{ cursor: 'pointer' }} onClick={() => { setHistory([]); localStorage.removeItem('nexo_history_pro'); }} />}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {history.map((h) => (
              <div key={h.id || Math.random()} onClick={() => { setMethod(h.method); setUrl(h.url); setBulkMode(false); }} style={{ fontSize: '10px', background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                  <span style={{ color: h.method === 'GET' ? '#0ea5e9' : '#10b981', fontWeight: 'bold', marginRight: '5px' }}>{h.method}</span>
                  <span style={{ color: theme.textColor }}>{h.url}</span>
                </div>
                <div style={{ color: h.success ? '#10b981' : '#ef4444', fontSize: '9px' }}>{h.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 12px 12px 0', overflow: 'hidden', boxSizing: 'border-box' }}>
        
        <div style={{ ...glassPanel, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', background: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', padding: '6px 12px', borderRadius: '20px', border: theme.panelBorder }}>
            <ShieldAlert size={13} color={useProxy ? '#06b6d4' : theme.subTextColor} />
            <span style={{ color: useProxy ? '#06b6d4' : theme.subTextColor, fontWeight: '500' }}>Bypass CORS Proxy</span>
            <input type="checkbox" checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} style={{ display: 'none' }}/>
          </label>
          <button onClick={saveToCollection} style={{ background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: theme.panelBorder, color: theme.textColor, padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Save size={13} color="#06b6d4" /> Save Request
          </button>
        </div>

        {bulkMode ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
            <div style={{ ...glassPanel, padding: '16px', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><h4 style={{ margin: 0, fontSize: '15px', color: '#06b6d4' }}>Batch Execution Engine: {currentBulkName}</h4><span style={{ fontSize: '11px', color: theme.subTextColor }}>{bulkData.length} Records Loaded</span></div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={downloadExcelReport} disabled={bulkResults.length === 0} style={{ background: bulkResults.length > 0 ? '#0284c7' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: bulkResults.length > 0 ? 'pointer' : 'not-allowed', fontWeight: '600', fontSize: '11px', display: 'flex', gap: '6px' }}><Download size={13}/> Export</button>
                  <button onClick={runBulkCollection} disabled={bulkRunning} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '11px', display: 'flex', gap: '6px' }}><Play size={13}/> {bulkRunning ? 'Running...' : 'Start Execution'}</button>
                  <button onClick={() => setBulkMode(false)} style={{ background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', border: 'none', color: theme.textColor, padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>Exit Bulk View</button>
                </div>
              </div>
            </div>
            
            <div style={{ flex: 1, display: 'flex', gap: '12px', overflow: 'hidden' }}>
              <div style={{ ...glassPanel, flex: '1 1 50%', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, background: isDarkMode ? 'rgba(15,23,42,0.95)' : 'rgba(241,245,249,0.95)' }}>
                    <tr style={{ color: theme.subTextColor, borderBottom: theme.panelBorder }}>
                      <th style={{ padding: '10px 12px' }}>ID</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px' }}>Code</th>
                      <th style={{ padding: '10px 12px' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkData.map((row, idx) => {
                      const res = bulkResults.find(r => r.index === idx + 1);
                      return (
                        <tr key={idx} onClick={() => res && setSelectedResult(res)} style={{ borderBottom: theme.panelBorder, cursor: res ? 'pointer' : 'default', background: selectedResult?.index === idx + 1 ? 'rgba(6,182,212,0.1)' : 'transparent' }}>
                          <td style={{ padding: '8px 12px' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{res ? (res.success ? <span style={{ color: '#10b981' }}>✓ PASSED</span> : <span style={{ color: '#ef4444' }}>✗ FAILED</span>) : <span style={{ color: theme.subTextColor }}>Pending</span>}</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{res ? res.status : '-'}</td>
                          <td style={{ padding: '8px 12px', color: theme.subTextColor }}>{res ? res.time : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* DETAILED BULK ROW RESPONSE PANEL */}
              <div style={{ ...glassPanel, flex: '1 1 50%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', padding: '8px 14px', borderBottom: theme.panelBorder, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: theme.subTextColor, letterSpacing: '1px' }}>ROW RESPONSE DETAIL</span>
                  {selectedResult && (
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: selectedResult.success ? '#10b981' : '#ef4444' }}>
                      Status: {selectedResult.status} {selectedResult.statusText}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, padding: '14px', overflowY: 'auto' }}>
                  {selectedResult ? (
                    <pre style={{ margin: '0', color: selectedResult.success ? '#0ea5e9' : '#ef4444', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {typeof selectedResult.data === 'object' ? JSON.stringify(selectedResult.data, null, 2) : String(selectedResult.data)}
                    </pre>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.subTextColor, fontSize: '11px' }}>Select any completed row from table to inspect error/response</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
            
            <div style={{ ...glassPanel, display: 'flex', padding: '6px', gap: '8px', flexShrink: 0 }}>
              <select value={method} onChange={e => setMethod(e.target.value)} style={{ background: theme.inputBg, color: '#06b6d4', border: theme.inputBorder, borderRadius: '8px', padding: '8px 14px', fontWeight: 'bold', outline: 'none', cursor: 'pointer', fontSize: '11px' }}>
                <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>PATCH</option>
              </select>
              <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="Enter API endpoint URL..." style={{ flex: 1, background: theme.inputBg, color: theme.inputColor, border: theme.inputBorder, borderRadius: '8px', padding: '8px 14px', outline: 'none', fontFamily: 'monospace', fontSize: '12px' }} />
              <button onClick={handleSend} disabled={loading} style={{ background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)', fontSize: '11px' }}>
                <Send size={14} /> {loading ? 'Sending...' : 'Send'}
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
              <div style={{ ...glassPanel, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', borderBottom: theme.panelBorder, flexShrink: 0 }}>
                  {['params', 'authorization', 'headers', 'body'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 20px', background: 'transparent', color: activeTab === tab ? '#06b6d4' : theme.subTextColor, border: 'none', borderBottom: activeTab === tab ? '2px solid #06b6d4' : '2px solid transparent', cursor: 'pointer', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>
                      {tab}
                    </button>
                  ))}
                </div>
                
                <div style={{ flex: 1, padding: '14px', overflowY: 'auto' }}>
                  {activeTab === 'headers' && (
                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                      <tbody>
                        {headersList.map((h, i) => (
                          <tr key={i}>
                            <td style={{ width: '25px' }}><input type="checkbox" checked={h.enabled} onChange={e => updateKV(headersList, setHeadersList, i, 'enabled', e.target.checked)} /></td>
                            <td style={{ padding: '4px' }}><input type="text" value={h.key} onChange={e => updateKV(headersList, setHeadersList, i, 'key', e.target.value)} style={inputStyle} placeholder="Key" /></td>
                            <td style={{ padding: '4px' }}><input type="text" value={h.value} onChange={e => updateKV(headersList, setHeadersList, i, 'value', e.target.value)} style={inputStyle} placeholder="Value" /></td>
                            <td style={{ width: '25px', textAlign: 'right' }}><Trash2 size={13} color="#ef4444" style={{ cursor: 'pointer' }} onClick={() => removeKV(headersList, setHeadersList, i)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeTab === 'authorization' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '11px' }}>
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <span style={{ color: theme.subTextColor, width: '90px', fontWeight: '600' }}>Auth Type:</span>
                        <select value={authType} onChange={(e) => setAuthType(e.target.value)} style={{ ...inputStyle, width: '180px' }}>
                          <option value="none">No Auth</option><option value="bearer">Bearer Token</option><option value="basic">Basic Auth</option>
                        </select>
                      </div>
                      {authType === 'bearer' && (
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                           <span style={{ color: theme.subTextColor, width: '90px', fontWeight: '600' }}>Token:</span>
                           <input type="text" value={bearerToken} onChange={(e) => setBearerToken(e.target.value)} placeholder="ey..." style={inputStyle} />
                        </div>
                      )}
                      {authType === 'basic' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                           <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                              <span style={{ color: theme.subTextColor, width: '90px', fontWeight: '600' }}>Username:</span>
                              <input type="text" value={basicAuth.username} onChange={(e) => setBasicAuth({...basicAuth, username: e.target.value})} style={{...inputStyle, maxWidth: '280px'}} />
                           </div>
                           <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                              <span style={{ color: theme.subTextColor, width: '90px', fontWeight: '600' }}>Password:</span>
                              <input type="password" value={basicAuth.password} onChange={(e) => setBasicAuth({...basicAuth, password: e.target.value})} style={{...inputStyle, maxWidth: '280px'}} />
                           </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'body' && (
                    <textarea value={rawBody} onChange={e => setRawBody(e.target.value)} style={{ width: '100%', height: '100%', background: theme.inputBg, color: '#0ea5e9', border: theme.inputBorder, borderRadius: '8px', padding: '10px', fontFamily: 'monospace', outline: 'none', resize: 'none', fontSize: '11px' }} />
                  )}
                </div>
              </div>

              {/* RESPONSE PANEL WITH STATUS & ERROR PAYLOAD */}
              <div style={{ ...glassPanel, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', padding: '8px 14px', borderBottom: theme.panelBorder, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: theme.subTextColor, letterSpacing: '1px' }}>RESPONSE PAYLOAD</span>
                  {response && (
                    <div style={{ display: 'flex', gap: '10px', fontSize: '11px', fontWeight: '600' }}>
                      <span style={{ color: response.success ? '#10b981' : '#ef4444' }}>Status: {response.status} {response.statusText}</span>
                      <span style={{ color: '#06b6d4' }}>{response.time}</span>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, padding: '14px', overflowY: 'auto' }}>
                  {response ? (
                    <pre style={{ margin: '0', color: response.success ? '#0ea5e9' : '#ef4444', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : String(response.data || response.statusText || 'No Response Payload')}
                    </pre>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.subTextColor, fontSize: '11px' }}>Enter API details and click Send</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showEnvModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: isDarkMode ? '#0f172a' : '#ffffff', color: theme.textColor, width: '480px', borderRadius: '12px', border: theme.panelBorder, padding: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#06b6d4' }}>Environment Variables</h4>
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginBottom: '14px' }}>
              <tbody>
                {envVars.map((env, i) => (
                  <tr key={i}>
                    <td style={{ width: '25px' }}><input type="checkbox" checked={env.enabled} onChange={e => updateKV(envVars, saveEnvs, i, 'enabled', e.target.checked)} /></td>
                    <td style={{ padding: '4px' }}><input type="text" value={env.key} onChange={e => updateKV(envVars, saveEnvs, i, 'key', e.target.value)} style={inputStyle} placeholder="Key" /></td>
                    <td style={{ padding: '4px' }}><input type="text" value={env.value} onChange={e => updateKV(envVars, saveEnvs, i, 'value', e.target.value)} style={inputStyle} placeholder="Value" /></td>
                    <td style={{ width: '25px', textAlign: 'right' }}><Trash2 size={13} color="#ef4444" style={{ cursor: 'pointer' }} onClick={() => removeKV(envVars, saveEnvs, i)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => addKV(envVars, saveEnvs)} style={{ background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: theme.textColor, border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>+ Add Row</button>
              <button onClick={() => setShowEnvModal(false)} style={{ background: '#06b6d4', color: '#000', border: 'none', padding: '6px 18px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
