import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api, queryKeys } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/_core/hooks/useAuth';

interface LanguageSwitcherProps {
  variant?: 'default' | 'ghost' | 'outline';
  showLabel?: boolean;
  className?: string;
}

export function LanguageSwitcher({ variant = 'ghost', showLabel = false, className = '' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  const queryClient = useQueryClient();
  const updateLanguageMutation = useMutation({ mutationFn: api.updateLanguage });

  const languages = [
    { code: 'de' as const, label: 'Deutsch', flag: '🇩🇪' },
    { code: 'en' as const, label: 'English', flag: '🇬🇧' },
  ];

  const currentLangCode = i18n.language?.split('-')[0] || 'de';
  const currentLang = languages.find(l => l.code === currentLangCode) || languages[0];

  const handleLanguageChange = async (langCode: 'de' | 'en') => {
    // Change UI language
    await i18n.changeLanguage(langCode);

    // Persist to backend if logged in
    if (user) {
      try {
        await updateLanguageMutation.mutateAsync({ language: langCode });
        // Optionally invalidate 'me' query to update context
        queryClient.invalidateQueries({ queryKey: queryKeys.me });
      } catch (error) {
        console.error('Failed to save language preference:', error);
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={showLabel ? 'default' : 'icon'} className={className}>
          <span className="text-base">{currentLang.flag}</span>
          {showLabel && <span className="ml-2">{currentLang.code.toUpperCase()}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={currentLangCode === lang.code ? 'bg-muted' : ''}
          >
            <span className="text-base mr-2">{lang.flag}</span>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
