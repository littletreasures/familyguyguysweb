import React, { useState } from "react";
import { QuizResult } from "../data/headersGaggsQuiz";
import { trackHeadersGaggsEvent } from "../lib/headersGaggsAnalytics";

interface HeadersGaggsShareProps {
  result: QuizResult;
}

export const HeadersGaggsShare: React.FC<HeadersGaggsShareProps> = ({ result }) => {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/headers-gaggs?result=${result.code}`
    : `https://familyguyguys.com/headers-gaggs?result=${result.code}`;

  const shareText = `I took the Family Guy Guys Headers-Gaggs Test and got:\n${result.code} — ${result.name}\n\nTake the completely legitimate test:\n${shareUrl}`;

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Headers-Gaggs Test: ${result.name}`,
          text: shareText,
          url: shareUrl,
        });
        trackHeadersGaggsEvent("headers_gaggs_shared", { method: "share_api", result_code: result.code });
        setCopyStatus("Shared successfully!");
        setTimeout(() => setCopyStatus(null), 3000);
        return;
      } catch (err) {
        // User cancelled or share failed, fallback to clipboard
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText);
        trackHeadersGaggsEvent("headers_gaggs_shared", { method: "clipboard", result_code: result.code });
        setCopyStatus("Copied result link to clipboard!");
        setTimeout(() => setCopyStatus(null), 3000);
      } catch (err) {
        setCopyStatus("Failed to copy link.");
        setTimeout(() => setCopyStatus(null), 3000);
      }
    }
  };

  return (
    <div className="headers-gaggs-share-block">
      <button onClick={handleShare} className="btn-orange headers-gaggs-share-btn">
        SHARE YOUR RESULT
      </button>

      {copyStatus && (
        <div className="headers-gaggs-share-status" role="status">
          {copyStatus}
        </div>
      )}
    </div>
  );
};
