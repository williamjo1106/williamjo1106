/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Link as LinkIcon, User, ExternalLink, Share2, Trash2, ShieldCheck, Lock, AlertTriangle, RefreshCw, Eye, EyeOff, Edit2, Check, X, GripVertical, FileDown, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import * as XLSX from 'xlsx';

interface SharedLink {
  id: string;
  url: string;
  title: string;
  authorName: string;
  category: string;
  createdAt: number;
}

const CATEGORY_CONFIG = [
  { id: 'notice', color: 'bg-rose-500', iconColor: 'text-rose-500' },
  { id: 'practice1', color: 'bg-emerald-500', iconColor: 'text-emerald-500' },
  { id: 'practice2', color: 'bg-amber-500', iconColor: 'text-amber-500' },
  { id: 'practice3', color: 'bg-purple-500', iconColor: 'text-purple-500' },
];

export default function App() {
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({
    notice: '공지사항',
    practice1: '실습1',
    practice2: '실습2',
    practice3: '실습3',
  });
  const [categoryWidths, setCategoryWidths] = useState<Record<string, number>>({
    notice: 320,
    practice1: 320,
    practice2: 320,
    practice3: 320,
  });
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('padlet_user_name') || '');
  const [isHost, setIsHost] = useState<boolean>(() => localStorage.getItem('padlet_is_host') === 'true');
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(!localStorage.getItem('padlet_user_name'));
  const [tempName, setTempName] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Resizing state
  const [resizingCategory, setResizingCategory] = useState<string | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // Editing state for category names
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  // State for each category's input
  const [inputs, setInputs] = useState<Record<string, { url: string, title: string }>>({
    notice: { url: '', title: '' },
    practice1: { url: '', title: '' },
    practice2: { url: '', title: '' },
    practice3: { url: '', title: '' },
  });
  const [isAdding, setIsAdding] = useState<Record<string, boolean>>({});

  const fetchLinks = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const response = await fetch('/api/links');
      if (response.ok) {
        const data = await response.json();
        setLinks(data.links);
        setHiddenCategories(data.hiddenCategories || []);
        if (data.categoryNames) setCategoryNames(data.categoryNames);
        if (data.categoryWidths) setCategoryWidths(data.categoryWidths);
      }
    } catch (error) {
      console.error('Failed to fetch links:', error);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  // Polling for real-time updates
  useEffect(() => {
    fetchLinks();
    const interval = setInterval(() => fetchLinks(true), 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  // Handle resizing events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingCategory) return;
      
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(200, Math.min(600, startWidthRef.current + deltaX));
      
      setCategoryWidths(prev => ({
        ...prev,
        [resizingCategory]: newWidth
      }));
    };

    const handleMouseUp = async () => {
      if (!resizingCategory) return;
      
      const finalWidth = categoryWidths[resizingCategory];
      setResizingCategory(null);

      // Sync with server
      try {
        await fetch('/api/categories/resize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId: resizingCategory, width: finalWidth }),
        });
      } catch (error) {
        console.error('Failed to sync resize:', error);
      }
    };

    if (resizingCategory) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCategory, categoryWidths]);

  const handleSaveName = () => {
    if (showPasswordInput) {
      if (tempPassword === '9207') {
        localStorage.setItem('padlet_user_name', 'Host (관리자)');
        localStorage.setItem('padlet_is_host', 'true');
        setUserName('Host (관리자)');
        setIsHost(true);
        setIsNameDialogOpen(false);
      } else {
        alert('비밀번호가 틀렸습니다.');
      }
    } else if (tempName.trim()) {
      localStorage.setItem('padlet_user_name', tempName.trim());
      localStorage.setItem('padlet_is_host', 'false');
      setUserName(tempName.trim());
      setIsHost(false);
      setIsNameDialogOpen(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('padlet_user_name');
    localStorage.removeItem('padlet_is_host');
    setUserName('');
    setIsHost(false);
    setIsNameDialogOpen(true);
    setTempName('');
    setTempPassword('');
    setShowPasswordInput(false);
  };

  const handleAddLink = async (categoryId: string) => {
    const input = inputs[categoryId];
    if (!input.url.trim() || !userName) return;

    setIsAdding(prev => ({ ...prev, [categoryId]: true }));
    try {
      let url = input.url.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }

      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title: categoryId === 'notice' ? (input.title.trim() || '공지사항') : userName,
          authorName: userName,
          category: categoryId,
        }),
      });

      if (response.ok) {
        setInputs(prev => ({
          ...prev,
          [categoryId]: { url: '', title: '' }
        }));
        fetchLinks(true);
      }
    } catch (error) {
      console.error('Failed to add link:', error);
    } finally {
      setIsAdding(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!isHost) return;
    if (!confirm('이 링크를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/links/${linkId}`, { method: 'DELETE' });
      if (response.ok) {
        fetchLinks(true);
      }
    } catch (error) {
      console.error('Failed to delete link:', error);
    }
  };

  const handleClearCategory = async (categoryId: string) => {
    if (!isHost) return;
    if (!confirm(`${categoryNames[categoryId]} 카테고리의 모든 링크를 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/categories/${categoryId}`, { method: 'DELETE' });
      if (response.ok) {
        fetchLinks(true);
      }
    } catch (error) {
      console.error('Failed to clear category:', error);
    }
  };

  const handleToggleVisibility = async (categoryId: string) => {
    if (!isHost) return;
    try {
      const response = await fetch('/api/categories/toggle-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      });
      if (response.ok) {
        fetchLinks(true);
      }
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
    }
  };

  const handleRenameCategory = async (categoryId: string) => {
    if (!editNameValue.trim()) return;
    try {
      const response = await fetch('/api/categories/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, newName: editNameValue.trim() }),
      });
      if (response.ok) {
        setEditingCategory(null);
        fetchLinks(true);
      }
    } catch (error) {
      console.error('Failed to rename category:', error);
    }
  };

  const handleResizeStart = (e: React.MouseEvent, categoryId: string) => {
    if (!isHost) return;
    e.preventDefault();
    setResizingCategory(categoryId);
    startXRef.current = e.clientX;
    startWidthRef.current = categoryWidths[categoryId] || 320;
  };

  const handleExportExcel = () => {
    const dataToExport = links.map(link => ({
      '이름': link.authorName,
      '제목': link.title,
      'URL': link.url,
      '카테고리': categoryNames[link.category] || link.category,
      '작성일': new Date(link.createdAt).toLocaleString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "EduShare_Links");
    XLSX.writeFile(workbook, `EduShare_Backup_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const formattedLinks = data.map((row: any) => ({
          authorName: row['이름'] || row['Name'] || row['authorName'] || '익명',
          title: row['제목'] || row['Title'] || row['title'] || '',
          url: row['URL'] || row['url'] || '',
          category: Object.keys(categoryNames).find(key => 
            categoryNames[key] === row['카테고리'] || 
            key === row['카테고리'] || 
            key === row['category']
          ) || 'practice1',
        })).filter(l => l.url);

        if (formattedLinks.length === 0) {
          alert('가져올 올바른 데이터가 없습니다. (이름, 제목, URL, 카테고리 컬럼을 확인해주세요)');
          return;
        }

        if (!confirm(`${formattedLinks.length}개의 링크를 가져오시겠습니까?`)) return;

        const response = await fetch('/api/links/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ links: formattedLinks }),
        });
        
        if (response.ok) {
          alert('성공적으로 데이터를 가져왔습니다.');
          fetchLinks(true);
        }
      } catch (err) {
        console.error('Import failed:', err);
        alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className={`min-h-screen bg-natural-bg text-natural-ink font-sans selection:bg-natural-clay/20 ${resizingCategory ? 'cursor-col-resize select-none' : ''}`}>
      {/* Header */}
      <header className="h-16 px-6 flex items-center justify-between border-b border-[#EBE9E4] bg-white sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-natural-accent rounded-lg flex items-center justify-center text-white font-bold">
            E
          </div>
          <h1 className="text-lg font-bold tracking-tight">EduShare Board</h1>
          {isHost && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase">
              <ShieldCheck size={10} />
              Host Mode
            </div>
          )}
          {isSyncing && <RefreshCw size={14} className="animate-spin text-natural-muted" />}
        </div>
        
        <div className="flex items-center gap-4">
          {isHost && (
            <div className="flex items-center gap-2 border-r pr-4 border-slate-200">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImportExcel} 
                className="hidden" 
                accept=".xlsx, .xls, .csv"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                className="h-8 gap-1.5 text-[11px] font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <FileUp size={14} />
                Excel Import
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportExcel}
                className="h-8 gap-1.5 text-[11px] font-bold border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <FileDown size={14} />
                Excel Export
              </Button>
            </div>
          )}
          <div className="hidden sm:block text-sm text-natural-muted">
            반갑습니다, <span className="text-natural-ink font-semibold underline underline-offset-4">{userName || 'Guest'}</span> 님
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="text-xs text-natural-muted hover:text-red-500"
          >
            로그아웃
          </Button>
        </div>
      </header>

      <main className="bg-natural-board min-h-[calc(100vh-64px)] p-4 md:p-6 overflow-x-auto">
        <div className="flex gap-6 items-start min-w-max pb-4">
          {CATEGORY_CONFIG.map((config) => {
            const isHidden = hiddenCategories.includes(config.id);
            const categoryName = categoryNames[config.id] || config.id;
            const currentWidth = categoryWidths[config.id] || 320;
            
            // If not host and category is hidden, don't render it at all
            if (!isHost && isHidden) return null;

            return (
              <div 
                key={config.id} 
                className={`flex flex-col gap-4 transition-opacity duration-300 relative group/col ${isHidden ? 'opacity-50 grayscale' : ''}`}
                style={{ width: `${currentWidth}px` }}
              >
                {/* Category Header & Input */}
                <Card className={`natural-card border-none overflow-hidden p-4 pb-5 ${
                  config.id === 'notice' ? 'bg-rose-100/80 border-rose-200' : isHidden ? 'bg-slate-50' : ''
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-2 h-6 ${config.color} rounded-full flex-shrink-0`} />
                      {editingCategory === config.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input 
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            className="h-7 text-sm px-2 py-0"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameCategory(config.id);
                              if (e.key === 'Escape') setEditingCategory(null);
                            }}
                          />
                          <button onClick={() => handleRenameCategory(config.id)} className="text-emerald-600"><Check size={14}/></button>
                          <button onClick={() => setEditingCategory(null)} className="text-rose-600"><X size={14}/></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 min-w-0">
                          <h2 className="font-bold text-lg truncate">{categoryName}</h2>
                          {isHost && (
                            <button 
                              onClick={() => {
                                setEditingCategory(config.id);
                                setEditNameValue(categoryName);
                              }}
                              className="text-slate-400 hover:text-natural-accent"
                            >
                              <Edit2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                      {isHidden && isHost && <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">(숨김)</span>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isHost && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-6 w-6 ${isHidden ? 'text-slate-500' : 'text-slate-300'} hover:text-natural-accent`}
                            onClick={() => handleToggleVisibility(config.id)}
                            title={isHidden ? "보이기" : "숨기기"}
                          >
                            {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-slate-300 hover:text-red-500"
                            onClick={() => handleClearCategory(config.id)}
                            title="전체 삭제"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Input Area */}
                  {(config.id !== 'notice' || isHost) ? (
                    <div className="grid grid-cols-1 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`url-${config.id}`} className="text-[10px] uppercase tracking-wider text-natural-muted">URL</Label>
                        <Input 
                          id={`url-${config.id}`}
                          placeholder="https://..." 
                          value={inputs[config.id].url}
                          onChange={(e) => setInputs(prev => ({
                            ...prev,
                            [config.id]: { ...prev[config.id], url: e.target.value }
                          }))}
                          className="h-7 text-[11px] bg-white/80 border-[#EBE9E4] focus:ring-natural-accent px-2"
                        />
                      </div>
                      {config.id === 'notice' && (
                        <div className="space-y-1">
                          <Label htmlFor={`title-${config.id}`} className="text-[10px] uppercase tracking-wider text-natural-muted">공지 내용</Label>
                          <Input 
                            id={`title-${config.id}`}
                            placeholder="공지사항 제목 또는 설명" 
                            value={inputs[config.id].title}
                            onChange={(e) => setInputs(prev => ({
                              ...prev,
                              [config.id]: { ...prev[config.id], title: e.target.value }
                            }))}
                            className="h-7 text-[11px] bg-white/80 border-[#EBE9E4] focus:ring-natural-accent px-2"
                          />
                        </div>
                      )}
                      <Button 
                        onClick={() => handleAddLink(config.id)}
                        disabled={isAdding[config.id] || !inputs[config.id].url.trim()}
                        className={`w-full h-7 text-[11px] ${config.id === 'notice' ? 'bg-rose-500' : 'bg-natural-accent'} hover:opacity-90 text-white rounded-md font-semibold transition-all active:scale-95 mt-1`}
                      >
                        {isAdding[config.id] ? '...' : config.id === 'notice' ? '공지 등록' : '공유하기'}
                      </Button>
                    </div>
                  ) : (
                    <div className="py-2 px-1">
                      <p className="text-[11px] text-rose-800/70 leading-relaxed italic">
                        관리자가 등록한 공지사항을 확인하세요.
                      </p>
                    </div>
                  )}
                </Card>

                {/* Links List for this category */}
                <div className="flex flex-col gap-3">
                  <AnimatePresence mode="popLayout">
                    {links
                      .filter(link => link.category === config.id)
                      .map((link, index) => (
                        <motion.div
                          key={link.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <div className={`rounded-lg p-2.5 shadow-sm border transition-shadow group relative ${
                            config.id === 'notice' 
                              ? 'bg-rose-50 border-rose-200 shadow-rose-200/50' 
                              : 'bg-white border-black/5'
                          } hover:shadow-md`}>
                            <h3 className={`text-[13px] font-bold leading-tight mb-0.5 line-clamp-2 pr-8 ${
                              config.id === 'notice' ? 'text-rose-900' : 'text-natural-ink'
                            }`}>
                              {link.title}
                            </h3>
                            <a 
                              href={link.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={`text-[10px] hover:underline line-clamp-1 mb-1.5 block overflow-hidden text-ellipsis whitespace-nowrap ${
                                config.id === 'notice' ? 'text-rose-600/70' : 'text-[#5A8FCF]'
                              }`}
                            >
                              {link.url}
                            </a>

                            <div className={`flex items-center justify-between pt-1.5 border-t border-dashed ${
                              config.id === 'notice' ? 'border-rose-200' : 'border-[#E5E2DD]'
                            }`}>
                              <div className="flex items-center gap-1">
                                {config.id === 'notice' ? (
                                  <>
                                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold uppercase bg-rose-200 text-rose-700">
                                      {link.authorName.charAt(0)}
                                    </div>
                                    <span className="text-[9px] font-semibold truncate max-w-[50px] text-rose-700">
                                      {link.authorName}
                                    </span>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-1 text-natural-muted">
                                    <User size={10} />
                                    <span className="text-[9px] font-medium">공유됨</span>
                                  </div>
                                )}
                              </div>
                              <span className={`text-[8px] ${
                                config.id === 'notice' ? 'text-rose-400' : 'text-[#BBB]'
                              }`}>
                                {new Date(link.createdAt).toLocaleTimeString('ko-KR', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                              })}
                            </span>
                          </div>
                          
                          <div className="absolute top-3 right-2 flex items-center gap-1">
                            {isHost && (
                              <button 
                                onClick={() => handleDeleteLink(link.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                                title="삭제"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                            <a 
                              href={link.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-slate-300 hover:text-natural-accent opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {links.filter(link => link.category === config.id).length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-[#D1CFC9]/30 rounded-xl">
                      <p className="text-[10px] text-natural-muted/40">비어 있음</p>
                    </div>
                  )}
                </div>

                {/* Resize Handle (Host Only) */}
                {isHost && (
                  <div 
                    className="absolute top-0 -right-3 w-1.5 h-full cursor-col-resize hover:bg-natural-accent/30 transition-colors z-10 flex items-center justify-center"
                    onMouseDown={(e) => handleResizeStart(e, config.id)}
                  >
                    <div className="w-0.5 h-8 bg-slate-200 rounded-full group-hover/col:bg-slate-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Name Entry Dialog */}
      <Dialog open={isNameDialogOpen} onOpenChange={(open) => !open && userName ? setIsNameDialogOpen(false) : null}>
        <DialogContent className="sm:max-w-[425px] bg-[#8B5E3C] border border-[#6F4E37] shadow-2xl opacity-100 text-white">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">{showPasswordInput ? 'Host 로그인' : '환영합니다!'}</DialogTitle>
            <DialogDescription className="text-[#E6D5C3]">
              {showPasswordInput 
                ? '관리자 비밀번호를 입력해주세요.' 
                : '링크를 공유하기 전에 이름을 입력해주세요. 다른 교육생들에게 이 이름으로 표시됩니다.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!showPasswordInput ? (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right text-xs text-[#FDFCF9]">
                  이름
                </Label>
                <Input
                  id="name"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="col-span-3 h-10 text-sm border-[#6F4E37] bg-white !text-black placeholder:text-slate-400 focus:ring-2 focus:ring-[#E6D5C3] outline-none"
                  placeholder=""
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
              </div>
            ) : (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="pass" className="text-right text-xs text-[#FDFCF9]">
                  비밀번호
                </Label>
                <Input
                  id="pass"
                  type="password"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="col-span-3 h-10 text-sm border-[#6F4E37] bg-white !text-black placeholder:text-slate-400 focus:ring-2 focus:ring-[#E6D5C3] outline-none"
                  placeholder=""
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-row justify-between items-center sm:justify-between bg-black/10 border-t border-white/10 p-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowPasswordInput(!showPasswordInput)}
              className="text-xs text-[#E6D5C3] hover:text-white hover:bg-white/10"
            >
              {showPasswordInput ? '교육생으로 접속' : 'Host로 접속'}
            </Button>
            <Button 
              onClick={handleSaveName} 
              disabled={showPasswordInput ? !tempPassword : !tempName.trim()}
              className="bg-[#FDFCF9] hover:bg-white text-[#8B5E3C] h-10 px-8 font-bold rounded-lg transition-all active:scale-95"
            >
              {showPasswordInput ? '로그인' : '시작하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
