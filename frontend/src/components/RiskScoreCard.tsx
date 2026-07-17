import React, { useState, useEffect } from 'react';
import { fetchRiskScore } from '../api';
import type { RiskScoreResponse, RiskCitation, RiskSubScore } from '../api';

interface RiskScoreCardProps {
    material: string;
}

export const RiskScoreCard: React.FC<RiskScoreCardProps> = ({ material }) => {
    const [riskData, setRiskData] = useState<RiskScoreResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedRiskType, setSelectedRiskType] = useState<{type: string, data: RiskSubScore} | null>(null);
    const [selectedCitation, setSelectedCitation] = useState<RiskCitation | null>(null);

    useEffect(() => {
        if (!material) return;
        setLoading(true);
        fetchRiskScore(material)
            .then(setRiskData)
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [material]);

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex justify-center items-center h-64">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!riskData) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex justify-center items-center h-64">
                <span className="text-gray-400 text-sm">No risk data available for {material}</span>
            </div>
        );
    }

    // Gauge Chart Logic
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (riskData.overall_risk / 100) * circumference;
    
    let colorClass = "text-green-500";
    let strokeClass = "stroke-green-500";
    if (riskData.overall_risk > 80) { colorClass = "text-red-500"; strokeClass = "stroke-red-500"; }
    else if (riskData.overall_risk > 65) { colorClass = "text-orange-500"; strokeClass = "stroke-orange-500"; }
    else if (riskData.overall_risk > 40) { colorClass = "text-yellow-500"; strokeClass = "stroke-yellow-500"; }

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours === 0) return "just now";
        return `${hours} hours ago`;
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden relative flex flex-col h-full">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-[12px] uppercase tracking-wider text-gray-500 font-bold">{material} Risk Score</h3>
                <span className="text-[10px] font-medium px-2 py-1 bg-blue-50 text-blue-600 rounded-full flex items-center gap-1 border border-blue-100">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Updated {timeAgo(riskData.last_updated)}
                </span>
            </div>
            
            <div className="p-6 flex-1">
                {/* Overall Gauge */}
                <div className="flex flex-col items-center mb-6">
                    <div className="relative w-32 h-32 flex justify-center items-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="64" cy="64" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
                            <circle 
                                cx="64" cy="64" r={radius} 
                                stroke="currentColor" strokeWidth="8" fill="transparent" 
                                className={`${strokeClass} transition-all duration-1000 ease-out`}
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-3xl font-black tracking-tighter ${colorClass}`}>{Math.round(riskData.overall_risk)}</span>
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">/ 100</span>
                        </div>
                    </div>
                </div>

                {/* Sub-Scores */}
                <div className="space-y-4">
                    {Object.entries(riskData.sub_scores).map(([type, data]) => {
                        if (!data) return null;
                        const citCount = data.citations.length;
                        return (
                            <div 
                                key={type} 
                                className="group cursor-pointer"
                                onClick={() => {
                                    setSelectedRiskType({ type, data });
                                    setSelectedCitation(null);
                                }}
                            >
                                <div className="flex justify-between text-xs mb-1.5 items-end">
                                    <span className="font-medium text-gray-700 capitalize flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                                        {type} 
                                        {citCount > 0 && <sup className="text-blue-500 font-bold ml-0.5">{citCount}</sup>}
                                        {citCount === 0 && <span className="text-gray-400 text-[10px] ml-1">(No sources)</span>}
                                    </span>
                                    <span className="font-mono text-gray-500 font-medium group-hover:text-blue-600 transition-colors">{Math.round(data.score)}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                    <div 
                                        className={`h-2 rounded-full transition-all duration-1000 ${data.score > 70 ? 'bg-red-400' : data.score > 40 ? 'bg-orange-400' : 'bg-green-400'}`}
                                        style={{ width: `${data.score}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sub-Score Citation List Drawer */}
            {selectedRiskType && !selectedCitation && (
                <div className="absolute inset-0 bg-white z-10 flex flex-col border-l border-gray-100 shadow-xl transform transition-transform animate-in slide-in-from-right">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setSelectedRiskType(null)} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{material} / <span className="text-blue-600 capitalize">{selectedRiskType.type}</span></span>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {selectedRiskType.data.citations.length === 0 ? (
                            <div className="text-center py-8">
                                <span className="text-2xl">⚠️</span>
                                <p className="text-sm text-gray-500 mt-2">No recent sources for this risk factor.<br/>Score based on historical data only.</p>
                            </div>
                        ) : (
                            selectedRiskType.data.citations.map(cit => (
                                <div 
                                    key={cit.id} 
                                    className="p-4 border border-gray-100 rounded-lg hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all bg-white group"
                                    onClick={() => setSelectedCitation(cit)}
                                >
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{cit.source}</span>
                                                <span className="text-gray-300">•</span>
                                                <span className="text-[10px] text-gray-400">{new Date(cit.published_date).toLocaleDateString()}</span>
                                            </div>
                                            <h4 className="text-sm font-medium text-gray-800 leading-snug group-hover:text-blue-700 line-clamp-2">{cit.title}</h4>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${
                                                cit.sentiment === 'negative' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                cit.sentiment === 'positive' ? 'bg-green-50 text-green-600 border border-green-100' :
                                                'bg-gray-100 text-gray-600 border border-gray-200'
                                            }`}>
                                                {cit.sentiment}
                                            </span>
                                            <span className="text-gray-400 group-hover:text-blue-500">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Citation Detail Panel */}
            {selectedCitation && selectedRiskType && (
                <div className="absolute inset-0 bg-white z-20 flex flex-col shadow-xl animate-in slide-in-from-bottom-8 duration-300">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            <button onClick={() => setSelectedCitation(null)} className="hover:text-gray-800 transition-colors">
                                {selectedRiskType.type}
                            </button>
                            <span>/</span>
                            <span className="text-blue-600 truncate max-w-[200px]">{selectedCitation.title}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-3">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-sm uppercase ${
                                    selectedCitation.sentiment === 'negative' ? 'bg-red-50 text-red-600 border border-red-100' :
                                    selectedCitation.sentiment === 'positive' ? 'bg-green-50 text-green-600 border border-green-100' :
                                    'bg-gray-100 text-gray-600 border border-gray-200'
                                }`}>
                                    {selectedCitation.sentiment} Impact
                                </span>
                                <span className="text-[11px] text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded-sm">
                                    Relevance: {Math.round(selectedCitation.relevance_score * 100)}%
                                </span>
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 leading-snug mb-2">{selectedCitation.title}</h2>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="font-semibold">{selectedCitation.source}</span>
                                <span>•</span>
                                <span>{new Date(selectedCitation.published_date).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 border-b border-gray-100 pb-2">Extracted Claims</h3>
                            {selectedCitation.extracted_claims.length > 0 ? (
                                <ul className="space-y-3">
                                    {selectedCitation.extracted_claims.map((claim, idx) => (
                                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                                            <span className="text-blue-500 mt-0.5">•</span>
                                            <span className="leading-relaxed">{claim}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No specific claims extracted.</p>
                            )}
                        </div>

                        <div>
                            <a 
                                href={selectedCitation.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="w-full py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                View Original Article
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                            {selectedCitation.source.includes('Bloomberg') || selectedCitation.source.includes('S&P') ? (
                                <p className="text-center text-[10px] text-orange-500 mt-3 font-medium flex items-center justify-center gap-1">
                                    <span>⚠️</span> Paywalled source — summary claims only
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
