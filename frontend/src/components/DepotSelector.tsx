import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Building2, ChevronDown } from 'lucide-react';
import { fetchAllDepots } from '../api';
import type { Depot } from '../api';

interface DepotSelectorProps {
  selectedDepotId: string | null;
  onSelectDepot: (depotId: string | null) => void;
}

export default function DepotSelector({ selectedDepotId, onSelectDepot }: DepotSelectorProps) {
  const [depots, setDepots] = useState<Depot[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentDepots, setRecentDepots] = useState<Depot[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAllDepots().then(data => setDepots(data.depots)).catch(console.error);
    
    // Load recents from localStorage
    try {
      const stored = localStorage.getItem('recentDepots');
      if (stored) setRecentDepots(JSON.parse(stored));
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (depot: Depot | null) => {
    onSelectDepot(depot ? depot.id : null);
    setIsOpen(false);
    setSearchQuery('');
    
    if (depot) {
      const newRecents = [depot, ...recentDepots.filter(d => d.id !== depot.id)].slice(0, 3);
      setRecentDepots(newRecents);
      localStorage.setItem('recentDepots', JSON.stringify(newRecents));
    }
  };

  const filteredDepots = depots.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedDepot = depots.find(d => d.id === selectedDepotId);

  return (
    <div className="flex items-center gap-4 z-50">
      {/* Recent Depots Quick Switch */}
      <div className="hidden md:flex items-center gap-2">
        {recentDepots.map(depot => (
          <button
            key={depot.id}
            onClick={() => handleSelect(depot)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5
              ${selectedDepotId === depot.id 
                ? 'bg-voltage-700 text-white font-medium' 
                : 'bg-canvas text-blue-100 bg-canvas'}`}
          >
            <span className="truncate max-w-[100px]">{depot.code}</span>
          </button>
        ))}
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between gap-3 px-4 py-2 bg-canvas bg-canvas text-white rounded-lg transition-all min-w-[240px] border border-white/10"
        >
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-blue-200" />
            <span className="font-medium truncate max-w-[150px]">
              {selectedDepotId === null ? 'All Depots' : selectedDepot?.name || 'Select Depot...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-300 font-mono bg-black/20 px-1.5 py-0.5 rounded border border-white/5">Ctrl+K</span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isOpen && (
          <div className="absolute top-full mt-2 w-[320px] right-0 bg-canvas rounded-xl shadow-2xl border border-hairline overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
            <div className="p-3 border-b border-hairline bg-canvas">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search depots by name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-canvas border border-hairline rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-voltage-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto p-2">
              <button
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                  ${selectedDepotId === null ? 'bg-voltage-50 text-voltage-700' : 'bg-canvas text-ink-muted'}`}
              >
                <div className={`p-1.5 rounded-md ${selectedDepotId === null ? 'bg-voltage-50 text-voltage-600' : 'bg-canvas-sunken text-ink-faint'}`}>
                  <Building2 size={16} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">All Depots</div>
                  <div className="text-xs text-ink-faint">View fleet comparison metrics</div>
                </div>
              </button>

              <div className="h-px bg-canvas-sunken my-2 mx-2"></div>

              {filteredDepots.map(depot => (
                <button
                  key={depot.id}
                  onClick={() => handleSelect(depot)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors
                    ${selectedDepotId === depot.id ? 'bg-voltage-50 text-voltage-700' : 'bg-canvas text-ink-muted'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${selectedDepotId === depot.id ? 'bg-voltage-50 text-voltage-600' : 'bg-canvas-sunken text-ink-faint'}`}>
                      <MapPin size={16} />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{depot.name}</div>
                      <div className="text-xs text-ink-faint flex items-center gap-1">
                        <span className="font-mono bg-canvas-sunken px-1 rounded">{depot.code}</span>
                        <span>•</span>
                        <span>{depot.region}</span>
                      </div>
                    </div>
                  </div>
                  {depot.vehicle_count === 0 ? (
                    <span className="text-xs font-medium px-2 py-1 bg-status-warning-bg text-status-warning-fg rounded-full">
                      Empty
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-1 bg-canvas-sunken text-ink-muted rounded-full shadow-sm">
                      {depot.vehicle_count} EVs
                    </span>
                  )}
                </button>
              ))}
              
              {filteredDepots.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-ink-faint">
                  No depots found matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

