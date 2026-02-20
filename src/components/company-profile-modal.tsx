"use client";

import { Modal } from "./modal";
import { ScoreBar } from "./score-bar";
import { StatusBadge } from "./status-badge";

interface CompanyProfileData {
  company_name: string;
  business_type: string;
  company_description: string;
  location: string;
  behavioral_score: number | null;
  product_lines: string[];
  network_member_since: string | null;
  request_type: string;
  industry: string;
}

interface CompanyProfileModalProps {
  open: boolean;
  onClose: () => void;
  company: CompanyProfileData | null;
}

export function CompanyProfileModal({ open, onClose, company }: CompanyProfileModalProps) {
  if (!company) return null;

  const memberSince = company.network_member_since
    ? new Date(company.network_member_since).toLocaleDateString()
    : "New to Network";

  return (
    <Modal open={open} onClose={onClose} title={company.company_name} width="max-w-lg">
      <div className="space-y-5">
        {/* Header info */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate">{company.location}</p>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={company.business_type === "Corporation" ? "active" : "pending"} />
              <span className="text-xs text-slate">{company.business_type}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-light-slate">Request Type</p>
            <StatusBadge status={company.request_type} />
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate mb-2">Description</p>
          <p className="text-sm text-charcoal leading-relaxed">{company.company_description}</p>
        </div>

        {/* Industry & Membership */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate mb-1">Industry</p>
            <p className="text-sm text-charcoal">{company.industry}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate mb-1">Member Since</p>
            <p className="text-sm text-charcoal">{memberSince}</p>
          </div>
        </div>

        {/* Behavioral Score */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate mb-2">Behavioral Score</p>
          {company.behavioral_score !== null ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold ${
                  company.behavioral_score >= 90 ? "text-success" :
                  company.behavioral_score >= 70 ? "text-teal" : "text-problem"
                }`}>
                  {company.behavioral_score}
                </span>
                <span className="text-sm text-slate">/ 100</span>
              </div>
              <ScoreBar label="Composite" value={company.behavioral_score} />
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-light-gray text-sm text-slate">
              New to Network — No behavioral data yet
            </div>
          )}
        </div>

        {/* Product Lines */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate mb-2">Product Lines</p>
          <div className="flex flex-wrap gap-2">
            {company.product_lines.map((line) => (
              <span
                key={line}
                className="px-2.5 py-1 text-xs bg-teal/10 text-teal-dark rounded-full"
              >
                {line}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
