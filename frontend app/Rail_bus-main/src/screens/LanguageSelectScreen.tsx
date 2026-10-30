import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Check } from 'lucide-react';

export const LanguageSelectScreen: React.FC = () => {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useApp();

  const handleSelectLanguage = (lang: 'en' | 'kn') => {
    setLanguage(lang);
  };

  const handleContinue = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F3F6FA] flex flex-col justify-between p-6 max-w-md mx-auto pt-safe pb-safe">
      <div className="space-y-6 pt-8">
        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-[#0B1F33] text-[#F5A524] flex items-center justify-center shadow-md">
          <span className="material-symbols-outlined text-[30px]">translate</span>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <h1 className="font-bold text-2xl text-[#0B1F33] tracking-tight">
            {t.language.chooseTitle}
          </h1>
          <p className="text-sm text-[#74777d] leading-relaxed">
            {t.language.chooseSubtitle}
          </p>
        </div>

        {/* Dual Language Cards */}
        <div className="space-y-3 pt-2">
          {/* English Option */}
          <button
            type="button"
            onClick={() => handleSelectLanguage('en')}
            className={`w-full p-5 rounded-2xl border transition-all text-left flex items-center justify-between active:scale-[0.99] shadow-sm ${
              language === 'en'
                ? 'bg-white border-[#0B1F33] shadow-md ring-2 ring-[#0B1F33]'
                : 'bg-white border-[#D9E1EA] hover:border-[#74777d]'
            }`}
          >
            <div className="space-y-0.5">
              <span className="font-bold text-lg text-[#0B1F33] block">English</span>
              <span className="text-xs text-[#74777d]">Mysuru Feeder Bus Transit</span>
            </div>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                language === 'en'
                  ? 'bg-[#0B1F33] border-[#0B1F33] text-white'
                  : 'border-[#c4c6cd]'
              }`}
            >
              {language === 'en' && <Check className="w-4 h-4 stroke-[3]" />}
            </div>
          </button>

          {/* Kannada Option */}
          <button
            type="button"
            onClick={() => handleSelectLanguage('kn')}
            className={`w-full p-5 rounded-2xl border transition-all text-left flex items-center justify-between active:scale-[0.99] shadow-sm ${
              language === 'kn'
                ? 'bg-white border-[#0B1F33] shadow-md ring-2 ring-[#0B1F33]'
                : 'bg-white border-[#D9E1EA] hover:border-[#74777d]'
            }`}
          >
            <div className="space-y-0.5">
              <span className="font-bold text-xl text-[#0B1F33] block font-kannada leading-relaxed">ಕನ್ನಡ</span>
              <span className="text-xs text-[#74777d] font-kannada">ಮೈಸೂರು ಫೀಡರ್ ಬಸ್ ಸಾರಿಗೆ</span>
            </div>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                language === 'kn'
                  ? 'bg-[#0B1F33] border-[#0B1F33] text-white'
                  : 'border-[#c4c6cd]'
              }`}
            >
              {language === 'kn' && <Check className="w-4 h-4 stroke-[3]" />}
            </div>
          </button>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="pt-8 pb-4">
        <button
          type="button"
          onClick={handleContinue}
          className="w-full h-[52px] rounded-xl bg-[#F5A524] text-[#0B1F33] font-bold text-base flex items-center justify-center shadow-sm active:scale-95 transition-transform"
        >
          {language === 'kn' ? 'ಕನ್ನಡದಲ್ಲಿ ಮುಂದುವರಿಯಿರಿ' : 'Continue in English'}
        </button>
      </div>
    </div>
  );
};
