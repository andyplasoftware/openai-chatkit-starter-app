"use client";

import { useState } from "react";

type AnswerModalProps = {
  isOpen: boolean;
  answer: string | null;
  isLoading: boolean;
  onClose: () => void;
  onSave: (answer: string) => Promise<void>;
};

export function AnswerModal({
  isOpen,
  answer,
  isLoading,
  onClose,
  onSave,
}: AnswerModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!answer) return;
    setIsSaving(true);
    try {
      await onSave(answer);
    } catch (error) {
      console.error("Error saving answer:", error);
      alert("Failed to save answer. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Generated Answer</h2>
          <button
            onClick={onClose}
            data-cursor-default="true"
            className="cursor-default-btn text-gray-400 hover:text-gray-600"
            style={{ cursor: 'pointer' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#740066]"></div>
              <span className="ml-3">Generating answer...</span>
            </div>
          ) : answer ? (
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap">{answer}</p>
            </div>
          ) : (
            <p className="text-gray-500">No answer generated</p>
          )}
        </div>
        
        {answer && !isLoading && (
          <div className="flex items-center justify-end gap-3 p-6 border-t">
            <button
              onClick={onClose}
              data-cursor-default="true"
              className="cursor-default-btn px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              style={{ cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              data-cursor-default={!isSaving ? "true" : undefined}
              className="cursor-default-btn px-4 py-2 text-white bg-[#740066] rounded-lg hover:bg-[#5a004d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ cursor: isSaving ? 'not-allowed' : 'pointer' }}
            >
              {isSaving ? "Saving..." : "Save Answer"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

