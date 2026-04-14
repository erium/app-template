import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Brain, ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  // Redirect to dashboard if logged in
  if (isAuthenticated) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">{t('app_name')}</span>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher showLabel={true} />
            <Link href="/login">
              <Button variant="ghost">{t('login')}</Button>
            </Link>
            <Link href="/register">
              <Button>{t('get_started')}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              {t('hero_title_1')} <br/>
              <span className="text-primary">{t('hero_title_2')}</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('hero_description')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="gap-2 h-12 px-8 text-lg">
                  {t('get_started')}
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-border">
        <div className="container">
          <div className="bg-primary rounded-3xl p-12 text-center text-primary-foreground">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('footer_cta_title')}
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              {t('footer_cta_desc')}
            </p>
            <Link href="/register">
              <Button size="lg" variant="secondary" className="gap-2">
                {t('footer_create_account')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-12 bg-muted/50">
        <div className="container text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {t('app_name')}. {t('footer_copyright')}</p>
          <div className="mt-4 flex justify-center gap-6">
            <Link href="/impressum" className="hover:text-foreground transition-colors">{t('imprint')}</Link>
            <Link href="/datenschutz" className="hover:text-foreground transition-colors">{t('privacy.title')}</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">{t('terms.title')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
