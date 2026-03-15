/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Plus, 
  Send, 
  Image as ImageIcon, 
  FileText, 
  RefreshCw, 
  Download, 
  Copy, 
  Check,
  AlertCircle,
  Sparkles,
  Banana,
  Paperclip,
  Loader2,
  Smile,
  Meh,
  Box,
  Palette
} from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_KEY = process.env.GEMINI_API_KEY || '';

interface GenerationResult {
  notices: {
    ko: string;
    en: string;
    vi: string;
    ja: string;
    zh: string;
  };
  imagePrompt: string;
  imageUrl?: string;
}

const LANGUAGES = [
  { id: 'ko', name: '한국어', flag: '🇰🇷' },
  { id: 'en', name: 'English', flag: '🇺🇸' },
  { id: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { id: 'ja', name: '日本語', flag: '🇯🇵' },
  { id: 'zh', name: '中文', flag: '🇨🇳' },
] as const;

type LangId = typeof LANGUAGES[number]['id'];

export default function App() {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [customTemplate, setCustomTemplate] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<LangId>('ko');
  const [imageStyle, setImageStyle] = useState<'3d' | 'cartoon'>('3d');
  const [imageExpression, setImageExpression] = useState<'happy' | 'serious'>('happy');
  
  const resultRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const GWANAK_DEFAULT_TEMPLATE = `[관악고등학교 가정통신문 표준 양식]

1. 행사명: 
2. 일시: 2026년 3월 
3. 장소: 관악고등학교 
4. 대상: 전교생 및 학부모
5. 주요 내용: 
   - 
   - 
6. 준비물: 
7. 기타 안내사항: 

위 내용을 바탕으로 관악고등학교 학부모님들을 위한 친절하고 이해하기 쉬운 가정통신문을 작성해 주세요.`;

  const loadGwanakTemplate = () => {
    setInputText(customTemplate || GWANAK_DEFAULT_TEMPLATE);
    setError(null);
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setError(null);
    try {
      const text = await extractTextFromFile(file);
      setCustomTemplate(text);
      setInputText(text); // Load it immediately too
      alert('관악고 표준양식이 성공적으로 탑재되었습니다.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || '양식 파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      setIsExtracting(false);
      if (templateInputRef.current) templateInputRef.current.value = '';
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'txt' || extension === 'md') {
      return await file.text();
    } else if (extension === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } else if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      return fullText;
    } else {
      throw new Error('지원하지 않는 파일 형식입니다. (TXT, MD, DOCX, PDF만 가능)');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setError(null);
    try {
      const text = await extractTextFromFile(file);
      setInputText(text);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '파일 내용을 읽는 중 오류가 발생했습니다.');
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const generateNotice = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      
      // 1. Generate Text and Image Prompt
      const textResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
          ### [입력 데이터]
          ${inputText}

          위 입력 데이터를 바탕으로, 학부모님들이 아주 쉽게 이해할 수 있는 다국어 가정통신문을 작성하고, 
          내용에 어울리는 맞춤형 캐릭터 삽화를 위한 프롬프트를 만들어줘.

          **1. 텍스트 작성 가이드:**
          - 총 5개 언어(한국어, 영어, 베트남어, 일본어, 중국어)로 각각 작성해.
          - 쉽게 풀어쓰기: 전문용어나 행정 용어는 학부모가 이해하기 쉬운 단어로 변경해.
          - 서식 준수: 아래 [표준 서식]을 따르되, 핵심 정보(날짜, 시간, 장소, 준비물)는 굵게 표시해.
          - 각 언어별로 문화적 맥락에 맞게 자연스럽게 번역해.

          **2. 삽화(이미지 생성 프롬프트) 가이드:**
          - 캐릭터 선정: 공지 내용에 가장 잘 어울리는 귀여운 마스코트나 캐릭터를 주인공으로 설정해줘. (예: 독서 행사라면 책 읽는 부엉이, 체육 대회라면 운동하는 강아지, 과학 캠프라면 실험하는 로봇 등)
          - 스타일: ${imageStyle === '3d' ? '친근하고 따뜻한 느낌의 고퀄리티 3D 일러스트레이션 (Pixar/Disney 스타일)' : '깔끔하고 귀여운 2D 카툰/벡터 일러스트레이션 스타일'}.
          - 표정/분위기: ${imageExpression === 'happy' ? '아주 밝게 웃고 있는 행복한 표정, 긍정적인 에너지' : '차분하고 신뢰감 있는 진지한 표정, 전문적인 느낌'}.
          - 내용 연관성: 생성된 가정통신문의 *가장 핵심적인 내용*을 해당 캐릭터가 수행하거나 표현하는 장면이어야 해.

          ---
          ### [출력 예시 서식 (한국어 기준)]
          [가정통신문 제2026-00호]
          제목: **(학부모가 한눈에 아는 쉬운 제목)**
          학부모님, 안녕하십니까?
          학교에서 자녀분들의 건강하고 즐거운 생활을 위해 **(이번 행사의 목적)**에 대해 안내해 드립니다.
          **1. 언제 하나요?**
          - 날짜: **2026년 X월 X일 (요일)**
          - 시간: **오전/오후 X시 ~ X시**
          **2. 어디서 하나요?**
          - 장소: **(정확한 장소, 예: 본교 체육관)**
          **3. 무엇을 준비해야 하나요?**
          - **(준비물 또는 복장)**
          **4. 꼭 알아두세요!**
          - (학부모 협조 사항 또는 주의 사항을 쉬운 개조식으로)
          궁금하신 점은 **(담당부서 및 전화번호)**로 언제든 연락주세요.
          2026. 03. 08.
          **[OOO학교장]** (직인생략)
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              notices: {
                type: Type.OBJECT,
                properties: {
                  ko: { type: Type.STRING, description: "Korean version" },
                  en: { type: Type.STRING, description: "English version" },
                  vi: { type: Type.STRING, description: "Vietnamese version" },
                  ja: { type: Type.STRING, description: "Japanese version" },
                  zh: { type: Type.STRING, description: "Chinese version" }
                },
                required: ["ko", "en", "vi", "ja", "zh"]
              },
              imagePrompt: { type: Type.STRING, description: "The English image generation prompt for a context-aware character" }
            },
            required: ["notices", "imagePrompt"]
          }
        }
      });

      const data = JSON.parse(textResponse.text || '{}');
      
      if (!data.notices || !data.imagePrompt) {
        throw new Error("Failed to generate content. Please try again.");
      }

      // 2. Generate Image
      let imageUrl = '';
      try {
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: data.imagePrompt }]
          },
          config: {
            imageConfig: {
              aspectRatio: "1:1"
            }
          }
        });

        for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      } catch (imgErr) {
        console.error("Image generation failed:", imgErr);
        // We still have the text, so we can show that
      }

      setResult({
        notices: data.notices,
        imagePrompt: data.imagePrompt,
        imageUrl: imageUrl || undefined
      });
      setSelectedLang('ko');

      // Scroll to result
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while generating the notice.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result.notices[selectedLang]);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const downloadImage = () => {
    if (result?.imageUrl) {
      const link = document.createElement('a');
      link.href = result.imageUrl;
      link.download = 'nano-banana-notice.png';
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-[#2D2D2D] font-sans selection:bg-yellow-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shadow-sm">
              <Banana className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-stone-800">
              나노바나나 <span className="text-yellow-600 font-medium">통신</span>
            </h1>
          </div>
          <div className="text-xs font-mono text-stone-400 uppercase tracking-widest">
            v1.1.0
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Intro Section */}
        <section className="space-y-4 text-center">
          <h2 className="text-4xl font-extrabold text-stone-900 tracking-tight sm:text-5xl">
            가정통신문을 <span className="text-yellow-500">더 쉽게, 더 귀엽게</span>
          </h2>
          <p className="text-lg text-stone-500 max-w-2xl mx-auto">
            복잡한 학교 공지사항을 학부모님이 이해하기 쉬운 언어로 바꾸고, 
            귀여운 나노바나나 캐릭터 삽화를 함께 만들어 드립니다.
          </p>
        </section>

        {/* Input Section */}
        <section className="bg-white rounded-3xl border border-stone-200 shadow-xl shadow-stone-200/50 overflow-hidden transition-all hover:shadow-2xl hover:shadow-stone-200/60">
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-stone-800 font-semibold">
                <FileText className="w-5 h-5 text-yellow-500" />
                <h3>공지사항 원문 입력</h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={loadGwanakTemplate}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 transition-all active:scale-95"
                    title={customTemplate ? "탑재된 표준양식 불러오기" : "기본 표준양식 불러오기"}
                  >
                    <Plus className="w-4 h-4" />
                    관악고 양식 불러오기
                  </button>
                  <input 
                    type="file" 
                    ref={templateInputRef} 
                    onChange={handleTemplateUpload} 
                    className="hidden" 
                    accept=".txt,.md,.docx,.pdf"
                  />
                  <button
                    onClick={() => templateInputRef.current?.click()}
                    className="p-2 rounded-xl text-stone-400 hover:text-yellow-600 hover:bg-yellow-50 transition-all"
                    title="표준양식 파일 직접 탑재 (업로드)"
                  >
                    <Download className="w-4 h-4 rotate-180" />
                  </button>
                </div>

                <div className="h-6 w-px bg-stone-200 mx-1 hidden sm:block" />

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".txt,.md,.docx,.pdf"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isExtracting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-stone-100 text-stone-600 hover:bg-stone-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isExtracting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                  공지내용 파일 첨부
                </button>
              </div>
            </div>
            
            <div className="relative">
              <textarea
                className="w-full h-64 p-5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-4 focus:ring-yellow-400/20 focus:border-yellow-400 outline-none transition-all resize-none text-stone-700 placeholder:text-stone-300"
                placeholder="여기에 학교에서 받은 공지사항이나 행사 내용을 붙여넣거나 파일을 첨부해 주세요..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              {isExtracting && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
                    <p className="text-sm font-bold text-stone-600">파일 내용을 읽는 중...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Image Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                  <Palette className="w-3 h-3" />
                  삽화 스타일
                </label>
                <div className="flex p-1 bg-stone-100 rounded-xl">
                  <button
                    onClick={() => setImageStyle('3d')}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                      imageStyle === '3d' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                    )}
                  >
                    <Box className="w-4 h-4" />
                    3D 입체
                  </button>
                  <button
                    onClick={() => setImageStyle('cartoon')}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                      imageStyle === 'cartoon' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                    )}
                  >
                    <ImageIcon className="w-4 h-4" />
                    2D 카툰
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                  <Smile className="w-3 h-3" />
                  캐릭터 표정
                </label>
                <div className="flex p-1 bg-stone-100 rounded-xl">
                  <button
                    onClick={() => setImageExpression('happy')}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                      imageExpression === 'happy' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                    )}
                  >
                    <Smile className="w-4 h-4" />
                    행복함
                  </button>
                  <button
                    onClick={() => setImageExpression('serious')}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                      imageExpression === 'serious' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                    )}
                  >
                    <Meh className="w-4 h-4" />
                    진지함
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={generateNotice}
              disabled={isLoading || !inputText.trim() || isExtracting}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95",
                isLoading || !inputText.trim() || isExtracting
                  ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                  : "bg-yellow-400 text-stone-900 hover:bg-yellow-500 shadow-lg shadow-yellow-400/30"
              )}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  가정통신문 & 삽화 만들기
                </>
              )}
            </button>
          </div>
        </section>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3 text-red-600">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Result Section */}
        {result && (
          <div ref={resultRef} className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Text Output */}
              <div className="lg:col-span-3 space-y-4">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-yellow-500" />
                      생성된 가정통신문
                    </h3>
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                    >
                      {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      {isCopied ? '복사됨' : '복사하기'}
                    </button>
                  </div>

                  {/* Language Tabs */}
                  <div className="flex flex-wrap gap-2 p-1 bg-stone-100 rounded-2xl">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => setSelectedLang(lang.id)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-bold transition-all",
                          selectedLang === lang.id
                            ? "bg-white text-stone-900 shadow-sm"
                            : "text-stone-500 hover:text-stone-700 hover:bg-white/50"
                        )}
                      >
                        <span>{lang.flag}</span>
                        <span className="hidden sm:inline">{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="bg-white border border-stone-200 rounded-3xl p-8 shadow-sm prose prose-stone max-w-none min-h-[400px]">
                  <div className="markdown-body">
                    <Markdown>{result.notices[selectedLang]}</Markdown>
                  </div>
                </div>
              </div>

              {/* Image Output */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-yellow-500" />
                    맞춤형 AI 삽화
                  </h3>
                  {result.imageUrl && (
                    <button
                      onClick={downloadImage}
                      className="p-1.5 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                      title="이미지 다운로드"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="bg-white border border-stone-200 rounded-3xl p-4 shadow-sm aspect-square flex items-center justify-center overflow-hidden group relative">
                  {result.imageUrl ? (
                    <img 
                      src={result.imageUrl} 
                      alt="Generated AI Illustration" 
                      className="w-full h-full object-cover rounded-2xl transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-center space-y-2 px-6">
                      <ImageIcon className="w-12 h-12 text-stone-200 mx-auto" />
                      <p className="text-sm text-stone-400">이미지 생성에 실패했거나 생성 중입니다.</p>
                    </div>
                  )}
                </div>

                <div className="bg-stone-100/50 rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Image Generation Prompt</p>
                  <p className="text-xs text-stone-500 italic leading-relaxed">
                    {result.imagePrompt}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        {!result && !isLoading && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
            {[
              { title: "쉬운 언어", desc: "행정 용어를 학부모가 이해하기 쉬운 단어로 자동 변환합니다.", icon: "✨" },
              { title: "표준 서식", desc: "학교에서 바로 사용할 수 있는 깔끔한 서식을 제공합니다.", icon: "📋" },
              { title: "맞춤 캐릭터", desc: "공지 내용에 딱 맞는 귀여운 캐릭터 삽화를 AI가 자동으로 생성합니다.", icon: "🎨" }
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm space-y-3">
                <div className="text-2xl">{item.icon}</div>
                <h4 className="font-bold text-stone-800">{item.title}</h4>
                <p className="text-sm text-stone-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-stone-100 text-center">
        <p className="text-sm text-stone-400">
          © 2026 Nano Banana School Notice Generator. Powered by Gemini AI.
        </p>
      </footer>
    </div>
  );
}
