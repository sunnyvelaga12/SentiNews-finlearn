import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ArrowRight } from 'lucide-react';
const SCHOOL_ARTICLES = [
    { slug: "what-is-a-stock", title: "What Is a Stock?", domain: "stocks", duration: "5 min read", summary: "Understand ownership in a company using simple pizza slice metaphors." },
    { slug: "what-is-nifty-50", title: "What Is Nifty 50?", domain: "markets", duration: "5 min read", summary: "Learn how the top 50 Indian companies benchmark market growth on the NSE." },
    { slug: "what-is-market-capitalization", title: "What Is Market Capitalization?", domain: "fundamentals", duration: "5 min read", summary: "Discover how company size is calculated using share price × total shares." },
    { slug: "what-is-an-ipo", title: "What Is an IPO?", domain: "stocks", duration: "5 min read", summary: "How private companies sell shares to the public for the first time." },
    { slug: "what-is-a-mutual-fund", title: "What Is a Mutual Fund?", domain: "personal_finance", duration: "5 min read", summary: "Understand pooled professional money management across diversified portfolios." }
];
export const SchoolPage = () => {
    return (<div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-3">
        <Badge variant="blue">SENTINEWS SCHOOL • PUBLIC KNOWLEDGE BASE</Badge>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
          Financial Concepts Explained Simply
        </h1>
        <p className="text-slate-600 text-lg max-w-xl mx-auto">
          Pre-rendered, visual 5-minute explanations of stocks, markets, valuation, and personal finance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {SCHOOL_ARTICLES.map((art) => (<Link key={art.slug} to={`/school/${art.slug}`}>
            <Card className="hover:border-senti-blue hover:shadow-xl transition-all space-y-3 h-full flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span className="uppercase text-senti-blue">{art.domain}</span>
                  <span>⏱️ {art.duration}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{art.title}</h2>
                <p className="text-slate-600 text-sm">{art.summary}</p>
              </div>
              <div className="flex items-center gap-1 text-senti-blue font-bold text-sm pt-2">
                <span>Read Full Visual Explanation</span>
                <ArrowRight className="w-4 h-4"/>
              </div>
            </Card>
          </Link>))}
      </div>
    </div>);
};
