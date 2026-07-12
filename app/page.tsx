'use client';

import React, { useState, useEffect } from 'react';

interface AuditItem {
  original: string;
  placeholder: string;
  category: string;
  reason: string;
  confidence: string;
}

interface HistoryItem {
  id: string;
  filename: string;
  time: string;
  status: string;
  processTime: string;
}

export default function RedactionPortal() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false); 
  
  // App Navigation & Storage State
  const [appView, setAppView] = useState<'workspace' | 'history'>('workspace');
  const [sessionHistory, setSessionHistory] = useState<HistoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false); 
  
  // Output States
  const [originalText, setOriginalText] = useState('');
  const [redactedText, setRedactedText] = useState('');
  const [summary, setSummary] = useState('');
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [auditLog, setAuditLog] = useState<AuditItem[]>([]);
  const [auditSearch, setAuditSearch] = useState(''); 
  
  // Feature States
  const [activeTab, setActiveTab] = useState<'redacted' | 'summary' | 'audit'>('redacted');
  const [showOriginal, setShowOriginal] = useState(false);
  const [processingTime, setProcessingTime] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);



  // Load History from Local Storage on Mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('redaction_history');
    if (savedHistory) {
      try {
        setSessionHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history");
      }
    }
    setIsLoaded(true);
  }, []);




  // Save History to Local Storage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('redaction_history', JSON.stringify(sessionHistory));
    }
  }, [sessionHistory, isLoaded]);



  // FEATURE: File Validation Logic (Max 5MB)
  const processFileSelection = (selectedFile: File) => {
    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMsg('File is too large. Maximum allowed size is 5MB.');
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setErrorMsg('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFileSelection(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/jpg'];
      
      if (!validTypes.includes(droppedFile.type) && !droppedFile.name.endsWith('.docx') && !droppedFile.name.endsWith('.txt') && !droppedFile.name.endsWith('.pdf') && !droppedFile.name.match(/\.(png|jpe?g)$/i)) {
        setErrorMsg('Invalid file type. Only TXT, PDF, DOCX, and Images are allowed.');
        return;
      }
      processFileSelection(droppedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setErrorMsg('Please select a file to process.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setShowOriginal(false);
    setAuditSearch('');
    
    const startTime = performance.now();

    setOriginalText('');
    setRedactedText('');
    setSummary('');
    setKeyPoints([]);
    setAuditLog([]);
    setProcessingTime(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      //backend API endpoint for processing the uploaded file render//
      const response = await fetch(
  "https://transcript-backend-lmrf.onrender.com/api/upload",
  {
    method: "POST",
    body: formData,
  }
);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Processing failed.');
      }

      const endTime = performance.now();
      const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
      setProcessingTime(timeTaken);

      setOriginalText(data.original_text || '');
      setRedactedText(data.redacted_transcript || ''); // Using redacted_transcript from backend
      setSummary(data.summary || '');
      setKeyPoints(data.key_points || []);
      setAuditLog(data.audit_log || []);
      
      setSessionHistory(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        filename: file.name,
        time: new Date().toLocaleString(),
        status: 'Processed',
        processTime: `${timeTaken}s`
      }, ...prev]);
      
    } catch (err: any) {
        if (err.message.includes('delimiter') || err.message.includes('JSON')) {
             setErrorMsg('Document structure caused AI processing error. Please click Process File again.');
        } else {
             setErrorMsg(err.message || 'Server connection failed.');
        }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setOriginalText('');
    setRedactedText('');
    setSummary('');
    setKeyPoints([]);
    setAuditLog([]);
    setErrorMsg('');
    setProcessingTime(null);
    setAuditSearch('');
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setSessionHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleExport = () => {
    const reportContent = `--- REDACTED TRANSCRIPT ---\n${redactedText}\n\n--- EXECUTIVE SUMMARY ---\n${summary}\n\n--- KEY HIGHLIGHTS ---\n${keyPoints.map(k => `* ${k}`).join('\n')}`;
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Redacted_Report_${file?.name || 'Log'}.txt`;
    a.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(redactedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderHighlightedText = (text: string) => {
    if (!text) return "";
    const regex = /(\b\d+(?:\.\d+)?(?:%|\s?crores|\s?lakhs|k|m)?\b|\[.*?\]|\b(?:revenue|ebitda|margin|growth|arr|burn|runway|exposure)\b)/gi;
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (part.match(regex)) {
        return (
          <mark key={index} className="bg-yellow-200 text-gray-900 px-1.5 mx-0.5 rounded-sm font-semibold shadow-sm">
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  const getPageCount = (text: string) => {
    if (!text) return 0;
    const wordCount = text.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / 300));
  };

  const getCategoryStats = () => {
    const stats: Record<string, number> = {};
    auditLog.forEach(log => {
      const cat = log.category || 'Other';
      stats[cat] = (stats[cat] || 0) + 1;
    });
    return stats;
  };

  const filteredAuditLog = auditLog.filter(log => 
    log.original.toLowerCase().includes(auditSearch.toLowerCase()) || 
    log.category.toLowerCase().includes(auditSearch.toLowerCase())
  );

  if (!isLoaded) return null; 

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans text-gray-800 flex flex-col">
      {/* NAVBAR */}
      <nav className="bg-white border-b-[3px] border-[#c0262c] shadow-sm sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex space-x-8 text-sm font-medium items-center">
              <span className="font-bold text-black text-base tracking-wide">Transcript Redaction Portal</span>
            </div>
            <div className="flex items-center space-x-4">
              {processingTime && (
                <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded-xl border border-gray-200">
                  Time Speed: {processingTime}s
                </span>
              )}
              <div className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Processing Fast
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8 w-full flex-grow print:py-0 print:px-0">
        <div className="flex justify-between items-end mb-6 print:hidden">
          <h1 className="text-2xl font-bold text-gray-900">
            {appView === 'workspace' ? 'Redaction Workspace' : 'Processing History'}
          </h1>
        </div>

        {/* MAIN LAYOUT */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 print:block print:w-full">
          
          {/* SIDEBAR NAVIGATION - Restored to classic arrow design */}
          <div className="md:col-span-2 space-y-2 print:hidden">
            <div 
              onClick={() => setAppView('workspace')}
              className={`p-4 font-semibold shadow-sm flex items-center justify-between cursor-pointer text-sm transition-all ${appView === 'workspace' ? 'bg-[#c0262c] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              <span>Workspace</span>
              {appView === 'workspace' && <span className="border-t-[8px] border-t-transparent border-l-[12px] border-l-white border-b-[8px] border-b-transparent"></span>}
            </div>
            <div 
              onClick={() => setAppView('history')}
              className={`p-4 font-semibold shadow-sm flex items-center justify-between cursor-pointer text-sm transition-all ${appView === 'history' ? 'bg-[#c0262c] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              <span>History</span>
              {appView === 'history' && <span className="border-t-[8px] border-t-transparent border-l-[12px] border-l-white border-b-[8px] border-b-transparent"></span>}
            </div>
          </div>

          {/* DYNAMIC VIEW RENDERER (Stacked Wide Layout) */}
          <div className="md:col-span-10 flex flex-col space-y-6 print:col-span-12">
            {appView === 'workspace' ? (
              <>
                {/* 1. UPLOAD INTERFACE */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl transition-all print:hidden w-full">
                  <div className="flex border-b border-gray-200 bg-gray-50/50 rounded-t-xl">
                    <div className="px-6 py-3 text-sm font-medium text-[#c0262c] border-b-2 border-[#c0262c]">File Upload</div>
                  </div>

                  <div className="p-8">
                    <div className="max-w-4xl mx-auto w-full">
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Supported: TXT, DOCX, PDF, PNG, JPG
                        </label>
                        <span className="text-[10px] text-gray-400 font-bold">MAX 5MB</span>
                      </div>
                      
                      {/* UPLOAD BOX WITH DRAG AND DROP */}
                      <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`mt-1 flex justify-center px-4 pt-10 pb-10 border-2 border-dashed rounded-xl transition-all relative overflow-hidden ${
                          isDragging ? 'border-[#c0262c] bg-red-50/50 scale-[1.01]' : 
                          loading ? 'border-black bg-gray-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="space-y-2 text-center w-full pointer-events-none">
                          <svg className={`mx-auto h-12 w-12 transition-colors ${loading ? 'text-black' : isDragging ? 'text-[#c0262c]' : 'text-gray-400'}`} stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          
                          <div className="flex flex-col items-center justify-center mt-3 pointer-events-auto">
                            <label className={`relative bg-transparent rounded-xl font-medium transition-colors ${loading ? 'cursor-default text-gray-400' : 'cursor-pointer text-blue-600 hover:text-blue-800'}`}>
                              <span className="text-sm break-all text-center block w-full">
                                {file ? file.name : isDragging ? "Drop file here" : "Click or drag file to upload"}
                              </span>
                              <input type="file" accept=".txt,.pdf,.docx,.png,.jpg,.jpeg" className="sr-only" onChange={handleFileChange} disabled={loading} />
                            </label>

                            {/* Thin Spinner and Processing Text */}
                            {loading && (
                              <div className="flex flex-col items-center justify-center mt-4 space-y-2">
                                <svg className="animate-spin h-5 w-5 text-black" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span className="text-[11px] text-gray-900 font-bold uppercase tracking-widest animate-pulse">Processing...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {errorMsg && (
                        <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium shadow-sm text-center">
                          ⚠️ {errorMsg}
                        </div>
                      )}

                      <div className="mt-5 flex items-center justify-center text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50 py-2 border border-gray-100 rounded-xl">
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                        Zero-Retention Policy Active
                      </div>

                      <div className="mt-6 flex items-center justify-end space-x-3">
                        <button 
                          onClick={handleReset}
                          className="px-5 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 text-xs shadow-sm transition-colors"
                        >
                          Reset
                        </button>
                        <button 
                          onClick={handleUpload}
                          disabled={loading}
                          className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 disabled:bg-blue-400 text-xs uppercase tracking-wider transition-colors flex items-center"
                        >
                          {loading && (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          )}
                          Process File
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. OUTPUT PANEL */}
                <div className="border border-gray-200 shadow-sm rounded-xl overflow-hidden flex flex-col min-h-[500px] bg-white print:border-none print:shadow-none w-full">
                  
                  {/* Tabs & Utilities Container */}
                  <div className="flex justify-between border-b border-gray-200 bg-gray-50 print:hidden">
                    <div className="flex">
                      <button
                        onClick={() => setActiveTab('redacted')}
                        className={`px-6 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'redacted' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
                      >
                        Redacted
                      </button>
                      <button
                        onClick={() => setActiveTab('summary')}
                        className={`px-6 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'summary' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
                      >
                        Insights
                      </button>
                      <button
                        onClick={() => setActiveTab('audit')}
                        className={`px-6 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors flex items-center ${activeTab === 'audit' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
                      >
                        Audit 
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'audit' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                          {auditLog.length}
                        </span>
                      </button>
                    </div>

                    {redactedText && (
                      <div className="flex items-center pr-3">
                        <button onClick={handlePrint} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors flex items-center border-r border-gray-200" title="Print as PDF">
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                          Print
                        </button>
                        <button onClick={handleExport} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors flex items-center">
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                          Export
                        </button>
                      </div>
                    )}
                  </div>

                  {/* FEATURE: Entity Analytics Dashboard */}
                  {auditLog.length > 0 && !loading && (
                    <div className="bg-gray-50 border-b border-gray-200 p-4 flex flex-wrap gap-2 print:hidden">
                      <span className="text-[11px] font-bold text-gray-400 uppercase mr-3 flex items-center">Entities Protected:</span>
                      {Object.entries(getCategoryStats()).map(([cat, count]) => (
                        <span key={cat} className="px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-xl text-[11px] font-bold shadow-sm">
                          {cat}: <span className="text-blue-600 ml-1.5">{count}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Content Area */}
                  <div className="p-8 flex-grow overflow-y-auto max-h-[600px] print:max-h-none print:overflow-visible">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center h-full mt-20 opacity-60">
                        <svg className="animate-spin h-10 w-10 text-blue-600 mb-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <p className="italic text-sm text-gray-500">Processing file and redacting data...</p>
                      </div>
                    ) : redactedText ? (
                      <>
                        {/* Tab 1: Redacted Transcript */}
                        {(activeTab === 'redacted' || window.matchMedia("print").matches) && (
                          <div className="print:mb-8">
                            <h2 className="hidden print:block text-xl font-bold mb-4 border-b pb-2">Redacted Transcript</h2>
                            <div className="flex justify-between items-center mb-4 print:hidden">
                              <div className="flex items-center space-x-4">
                                <label className="flex items-center space-x-2 text-sm cursor-pointer group">
                                  <input type="checkbox" checked={showOriginal} onChange={(e) => setShowOriginal(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-600 border-gray-300 w-4 h-4" />
                                  <span className={`${showOriginal ? 'text-red-600 font-bold' : 'text-gray-500 group-hover:text-gray-700'}`}>Show Original (Warning: PII Visible)</span>
                                </label>
                                
                                {showOriginal && (
                                  <span className="text-[11px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-2.5 py-1 rounded-xl border border-gray-200">
                                    EST. PAGES: {getPageCount(originalText)}
                                  </span>
                                )}
                              </div>
                              
                              <button onClick={handleCopy} className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center bg-blue-50 px-4 py-2 rounded-xl transition-colors">
                                {copied ? '✓ Copied!' : (
                                  <>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    Copy Text
                                  </>
                                )}
                              </button>
                            </div>
                            
                            <pre className={`text-sm whitespace-pre-wrap font-mono leading-relaxed p-6 border rounded-xl shadow-inner transition-colors print:shadow-none print:border-none print:p-0 print:text-[11px] ${showOriginal ? 'bg-red-50/30 text-red-900 border-red-200' : 'bg-[#fbfbfb] text-gray-700 border-gray-100'}`}>
                              {showOriginal ? originalText : renderHighlightedText(redactedText)}
                            </pre>
                          </div>
                        )}

                        {/* Tab 2: Call Summary & Highlights */}
                        {(activeTab === 'summary' || window.matchMedia("print").matches) && (
                          <div className="space-y-6 print:mb-8 print:break-inside-avoid">
                            <h2 className="hidden print:block text-xl font-bold mb-4 border-b pb-2">Executive Insights</h2>
                            <div className="bg-white p-6 border border-gray-100 rounded-xl shadow-sm print:shadow-none print:border-gray-300">
                              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center print:text-black">
                                <span className="w-2.5 h-2.5 bg-blue-600 rounded-full mr-2.5 print:bg-black"></span> Short Summary 
                              </h4>
                              <p className="text-sm text-gray-800 leading-relaxed print:text-xs">
                                {renderHighlightedText(summary)}
                              </p>
                            </div>
                            <div className="bg-white p-6 border border-gray-100 rounded-xl shadow-sm print:shadow-none print:border-gray-300">
                              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center print:text-black">
                                <span className="w-2.5 h-2.5 bg-blue-600 rounded-full mr-2.5 print:bg-black"></span> Key Points 
                              </h4>
                              <ul className="list-none space-y-4 text-sm text-gray-800 print:text-xs">
                                {keyPoints.map((point, index) => (
                                  <li key={index} className="leading-relaxed flex items-start">
                                    <span className="text-blue-600 mr-3 font-bold print:text-black">›</span>
                                    <span>{renderHighlightedText(point)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Tab 3: Security Audit Log Table - WITH 5 COLUMNS */}
                        {(activeTab === 'audit' || window.matchMedia("print").matches) && (
                          <div className="print:break-inside-avoid">
                            <h2 className="hidden print:block text-xl font-bold mb-4 border-b pb-2">Security Audit Log</h2>
                            
                            <div className="mb-5 print:hidden">
                              <div className="relative">
                                <input 
                                  type="text" 
                                  placeholder="Search original data or category..." 
                                  value={auditSearch}
                                  onChange={(e) => setAuditSearch(e.target.value)}
                                  className="w-full text-sm pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                                />
                                <svg className="w-4 h-4 text-gray-400 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                              </div>
                            </div>

                            <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm print:shadow-none print:border-gray-300">
                              <table className="min-w-full divide-y divide-gray-200 text-xs">
                                <thead className="bg-gray-50 text-gray-500 uppercase font-semibold tracking-wider print:bg-white print:text-black">
                                  <tr>
                                    <th className="px-5 py-3 text-left w-[25%] border-b border-gray-200">Original Data</th>
                                    <th className="px-5 py-3 text-left w-[20%] border-b border-gray-200">Redacted As</th>
                                    <th className="px-5 py-3 text-left w-[15%] border-b border-gray-200">Category</th>
                                    <th className="px-5 py-3 text-left w-[25%] border-b border-gray-200">Reason</th>
                                    <th className="px-5 py-3 text-left w-auto border-b border-gray-200">Confidence</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-gray-700 bg-white font-mono">
                                  {filteredAuditLog.length > 0 ? filteredAuditLog.map((log, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors print:break-inside-avoid">
                                      <td className="px-5 py-3 text-red-600 font-bold break-words print:text-black">{log.original}</td>
                                      <td className="px-5 py-3 text-blue-600 break-words print:text-black">{log.placeholder}</td>
                                      <td className="px-5 py-3">
                                        <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-xl text-[11px] font-sans font-bold border border-gray-200 print:bg-transparent print:border-none print:p-0 whitespace-normal text-left">
                                          {log.category}
                                        </span>
                                      </td>
                                      <td className="px-5 py-3 text-gray-600 text-[11px] font-sans whitespace-normal text-left">{log.reason}</td>
                                      <td className="px-5 py-3">
                                        <span className="inline-block px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-[11px] font-sans font-bold border border-green-200 print:bg-transparent print:border-none print:p-0">
                                          {log.confidence}
                                        </span>
                                      </td>
                                    </tr>
                                  )) : (
                                    <tr>
                                      <td colSpan={5} className="px-5 py-8 text-center text-gray-400 font-sans italic">
                                        No matching logs found for "{auditSearch}".
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full mt-24 print:hidden">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-5 border border-gray-100">
                           <span className="text-gray-300 text-3xl font-serif">¶</span>
                        </div>
                        <p className="text-sm text-gray-400 text-center italic">
                          Your results will appear here once the file is processed.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              
              /* HISTORY PAGE - Set to wide */
              <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-8 min-h-[500px] w-full">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Local Processing History</h2>
                    <p className="text-sm text-gray-500 mt-1">Stored securely on your local device.</p>
                  </div>
                  <div className="px-4 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-bold">
                    {sessionHistory.length} Records
                  </div>
                </div>

                {sessionHistory.length > 0 ? (
                  <div className="overflow-hidden border border-gray-200 rounded-xl">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold tracking-wider">
                        <tr>
                          <th className="px-6 py-4 text-left">File Name</th>
                          <th className="px-6 py-4 text-left">Timestamp</th>
                          <th className="px-6 py-4 text-left">Speed</th>
                          <th className="px-6 py-4 text-left">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-gray-700 font-medium">
                        {sessionHistory.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 flex items-center">
                               <svg className="w-4 h-4 mr-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"></path></svg>
                               {item.filename}
                            </td>
                            <td className="px-6 py-4 text-gray-500 text-xs">{item.time}</td>
                            <td className="px-6 py-4 text-gray-500 font-mono text-xs">{item.processTime}</td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                {item.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={(e) => handleDeleteHistory(item.id, e)}
                                className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-xl hover:bg-red-50"
                                title="Delete Log"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center mt-20 opacity-50">
                    <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    <p className="text-gray-500 text-sm font-medium">No local history found.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}