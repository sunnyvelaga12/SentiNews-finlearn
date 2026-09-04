import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, Sparkles } from 'lucide-react';
export const SchoolSlugPage = () => {
    const { slug } = useParams();
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "What Is a Stock?",
        "description": "Learn what a stock is in 5 minutes with visual explanations and interactive pizza slice metaphors.",
        "url": `https://sentinews.com/school/${slug}`
    };
    return (<article className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      {/* Dynamic JSON-LD structured data script for SEO crawlers */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}/>

      <Link to="/school" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4"/> Back to SentiNews School
      </Link>

      <div className="space-y-4">
        <Badge variant="blue">STOCKS & EQUITY SHARES</Badge>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
          What Is a Stock?
        </h1>
        <p className="text-slate-600 text-lg">
          Understand stock ownership, equity shares, and how companies raise capital in 5 simple minutes.
        </p>
      </div>

      <Card glass className="p-8 space-y-6 border-slate-200">
        <div className="flex items-center gap-2 text-senti-blue font-bold text-sm">
          <Sparkles className="w-4 h-4"/>
          <span>VISUAL STORY METAPHOR</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900">The Pizzeria Ownership Metaphor</h2>
        <p className="text-slate-700 text-base leading-relaxed">
          Imagine your favorite pizzeria wants to build 10 new branches, but needs money. Instead of taking a bank loan, the owner divides the business into 1,000 equal pizza slices (shares). If you buy 10 slices, you own 1% of the entire pizzeria business!
        </p>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-senti-blue-dark text-sm font-semibold">
          💡 Key Takeaway: Buying a stock makes you a legal part-owner of the company, entitled to a share of its long-term profit growth.
        </div>
      </Card>

      <div className="p-8 bg-gradient-to-r from-senti-900 to-senti-blue text-white rounded-3xl space-y-4 text-center">
        <h3 className="text-2xl font-extrabold">Ready to build your financial habit?</h3>
        <p className="text-slate-200 text-sm max-w-md mx-auto">
          Get 5-minute visual lessons, concept mastery tracking, and personalized daily recall practice.
        </p>
        <Link to="/app/home">
          <Button size="lg" variant="success" className="font-extrabold mt-2">
            Start 5-Minute Daily Learning
          </Button>
        </Link>
      </div>
    </article>);
};
