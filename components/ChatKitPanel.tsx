"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  STARTER_PROMPTS,
  PLACEHOLDER_INPUT,
  GREETING,
  CREATE_SESSION_ENDPOINT,
  WORKFLOW_ID,
  getThemeConfig,
} from "@/lib/config";
import { ErrorOverlay } from "./ErrorOverlay";
import { Sparkles } from "lucide-react";
import type { ColorScheme } from "@/hooks/useColorScheme";

export type FactAction = {
  type: "save";
  factId: string;
  factText: string;
};

type ChatKitPanelProps = {
  theme: ColorScheme;
  onWidgetAction: (action: FactAction) => Promise<void>;
  onResponseEnd: () => void;
  onThemeRequest: (scheme: ColorScheme) => void;
};

type ErrorState = {
  script: string | null;
  session: string | null;
  integration: string | null;
  retryable: boolean;
};

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV !== "production";

const createInitialErrors = (): ErrorState => ({
  script: null,
  session: null,
  integration: null,
  retryable: false,
});

export function ChatKitPanel({
  theme,
  onWidgetAction,
  onResponseEnd,
  onThemeRequest,
}: ChatKitPanelProps) {
  const processedFacts = useRef(new Set<string>());
  const [errors, setErrors] = useState<ErrorState>(() => createInitialErrors());
  const [isInitializingSession, setIsInitializingSession] = useState(true);
  const isMountedRef = useRef(true);
  const [scriptStatus, setScriptStatus] = useState<
    "pending" | "ready" | "error"
  >(() =>
    isBrowser && window.customElements?.get("openai-chatkit")
      ? "ready"
      : "pending"
  );
  const [widgetInstanceKey, setWidgetInstanceKey] = useState(0);
  
  // State for answer generation feature
  const [generatedAnswer, setGeneratedAnswer] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const pendingAnswerRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chatkitControlRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chatkitRef = useRef<any>(null);
  
  // Get user first name from URL for personalized greeting
  const getUserFirstName = () => {
    if (typeof window === "undefined") return "";
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('user_first_name') || "";
  };

    // Get question name from URL for personalized greeting
    const getQuestionName = () => {
      if (typeof window === "undefined") return "";
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('question_name') || "";
    };

  // Get show_generate_answer_button from URL
  const getShowGenerateAnswerButton = () => {
    if (typeof window === "undefined") return false;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('show_generate_answer_button') === 'true';
  };

  const setErrorState = useCallback((updates: Partial<ErrorState>) => {
    setErrors((current) => ({ ...current, ...updates }));
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    let timeoutId: number | undefined;

    const handleLoaded = () => {
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("ready");
      setErrorState({ script: null });
    };

    const handleError = (event: Event) => {
      console.error("Failed to load chatkit.js for some reason", event);
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("error");
      const detail = (event as CustomEvent<unknown>)?.detail ?? "unknown error";
      setErrorState({ script: `Error: ${detail}`, retryable: false });
      setIsInitializingSession(false);
    };

    window.addEventListener("chatkit-script-loaded", handleLoaded);
    window.addEventListener(
      "chatkit-script-error",
      handleError as EventListener
    );

    if (window.customElements?.get("openai-chatkit")) {
      handleLoaded();
    } else if (scriptStatus === "pending") {
      timeoutId = window.setTimeout(() => {
        if (!window.customElements?.get("openai-chatkit")) {
          handleError(
            new CustomEvent("chatkit-script-error", {
              detail:
                "ChatKit web component is unavailable. Verify that the script URL is reachable.",
            })
          );
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("chatkit-script-loaded", handleLoaded);
      window.removeEventListener(
        "chatkit-script-error",
        handleError as EventListener
      );
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [scriptStatus, setErrorState]);

  const isWorkflowConfigured = Boolean(
    WORKFLOW_ID && !WORKFLOW_ID.startsWith("wf_replace")
  );

  useEffect(() => {
    if (!isWorkflowConfigured && isMountedRef.current) {
      setErrorState({
        session: "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.",
        retryable: false,
      });
      setIsInitializingSession(false);
    }
  }, [isWorkflowConfigured, setErrorState]);

  const handleResetChat = useCallback(() => {
    processedFacts.current.clear();
    if (isBrowser) {
      setScriptStatus(
        window.customElements?.get("openai-chatkit") ? "ready" : "pending"
      );
    }
    setIsInitializingSession(true);
    setErrors(createInitialErrors());
    setWidgetInstanceKey((prev) => prev + 1);
  }, []);

  const getClientSecret = useCallback(
    async (currentSecret: string | null) => {
      if (isDev) {
        console.info("[ChatKitPanel] getClientSecret invoked", {
          currentSecretPresent: Boolean(currentSecret),
          workflowId: WORKFLOW_ID,
          endpoint: CREATE_SESSION_ENDPOINT,
        });
      }

      if (!isWorkflowConfigured) {
        const detail =
          "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
          setIsInitializingSession(false);
        }
        throw new Error(detail);
      }

      if (isMountedRef.current) {
        if (!currentSecret) {
          setIsInitializingSession(true);
        }
        setErrorState({ session: null, integration: null, retryable: false });
      }

      try {
        // Build URL with parameters from browser URL
        const url = new URL(CREATE_SESSION_ENDPOINT, window.location.origin);
        const urlParams = new URLSearchParams(window.location.search);
        url.searchParams.set('user_first_name', urlParams.get('user_first_name') || '');
        url.searchParams.set('user_last_name', urlParams.get('user_last_name') || '');
        url.searchParams.set('form_template_uid', urlParams.get('form_template_uid') || '');
        url.searchParams.set('user_id', urlParams.get('user_id') || '');
        url.searchParams.set('question_template_id', urlParams.get('question_template_id') || '');
        url.searchParams.set('version', urlParams.get('version') || '');
        
        const response = await fetch(url.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workflow: { id: WORKFLOW_ID },
            question_template_id: urlParams.get('question_template_id') || '',
            chatkit_configuration: {
              // enable attachments
              file_upload: {
                enabled: false,
              },
            },
          }),
        });

        const raw = await response.text();

        if (isDev) {
          console.info("[ChatKitPanel] createSession response", {
            status: response.status,
            ok: response.ok,
            bodyPreview: raw.slice(0, 1600),
          });
        }

        let data: Record<string, unknown> = {};
        if (raw) {
          try {
            data = JSON.parse(raw) as Record<string, unknown>;
          } catch (parseError) {
            console.error(
              "Failed to parse create-session response",
              parseError
            );
          }
        }

        if (!response.ok) {
          const detail = extractErrorDetail(data, response.statusText);
          console.error("Create session request failed", {
            status: response.status,
            body: data,
          });
          throw new Error(detail);
        }

        const clientSecret = data?.client_secret as string | undefined;
        if (!clientSecret) {
          throw new Error("Missing client secret in response");
        }

        if (isMountedRef.current) {
          setErrorState({ session: null, integration: null });
        }

        return clientSecret;
      } catch (error) {
        console.error("Failed to create ChatKit session", error);
        const detail =
          error instanceof Error
            ? error.message
            : "Unable to start ChatKit session.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
        }
        throw error instanceof Error ? error : new Error(detail);
      } finally {
        if (isMountedRef.current && !currentSecret) {
          setIsInitializingSession(false);
        }
      }
    },
    [isWorkflowConfigured, setErrorState]
  );

  // Handle saving answer to Bubble.io
  const handleSaveAnswer = useCallback(async (answer: string) => {
    const urlParams = new URLSearchParams(window.location.search);
    const questionId = urlParams.get('question_template_id') || "";
    const userId = urlParams.get('user_id') || "";
    
    setIsSaving(true);
    try {
      const response = await fetch("/api/save-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer,
          questionId,
          userId,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save answer");
      }
      
      // Clear answer after successful save
      setGeneratedAnswer(null);
      pendingAnswerRef.current = false;
    } catch (error) {
      console.error("Error saving answer:", error);
      alert("Failed to save answer. Please try again.");
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Helper function to extract text from message content
  const extractTextFromContent = useCallback((content: unknown): string => {
    if (!content) return "";
    
    if (Array.isArray(content)) {
      // Content is an array of parts
      return content
        .filter((part: unknown) => {
          if (typeof part === "object" && part !== null && "type" in part) {
            return (part as { type?: string }).type === "text";
          }
          return false;
        })
        .map((part: unknown) => {
          if (typeof part === "object" && part !== null) {
            const partObj = part as { text?: string; content?: unknown };
            return partObj.text || (typeof partObj.content === "string" ? partObj.content : "") || "";
          }
          return "";
        })
        .join("\n")
        .trim();
    } else if (typeof content === "string") {
      return content.trim();
    } else if (typeof content === "object" && content !== null) {
      const contentObj = content as { text?: unknown; content?: unknown };
      if (contentObj.text) {
        return String(contentObj.text).trim();
      } else if (contentObj.content) {
        return extractTextFromContent(contentObj.content);
      }
    }
    
    return "";
  }, []);

  // Custom onResponseEnd that captures generated answers
  const handleResponseEndWithCapture = useCallback(() => {
    onResponseEnd();
    
    // If we're waiting for a generated answer, extract it from the thread
    if (pendingAnswerRef.current) {
      // Use setTimeout to ensure the thread is updated
      setTimeout(() => {
        try {
          // Try to get thread from chatkit.control if available
          const currentChatkit = chatkitRef.current;
          let thread = null;
          
          if (currentChatkit?.control?.getThread) {
            thread = currentChatkit.control.getThread();
          } else if (currentChatkit?.getThread) {
            thread = currentChatkit.getThread();
          } else if (chatkitControlRef.current?.getThread) {
            thread = chatkitControlRef.current.getThread();
          }
          
          if (isDev) {
            console.debug("[ChatKitPanel] Thread data:", JSON.stringify(thread, null, 2));
          }
          
          if (thread && typeof thread === "object" && thread !== null && "items" in thread) {
            const threadObj = thread as { items?: unknown[] };
            if (threadObj.items && Array.isArray(threadObj.items) && threadObj.items.length > 0) {
              // Find the assistant response - look for the last assistant message
              // that comes after our "Generate a comprehensive answer" request
              let assistantResponse: { content: unknown } | null = null;
              
              // First, try to find our request message
              const generateRequestIndex = threadObj.items.findIndex((item: unknown) => {
                if (typeof item === "object" && item !== null && "role" in item && "content" in item) {
                  const itemObj = item as { role: unknown; content: unknown };
                  return itemObj.role === "user" && 
                    itemObj.content && 
                    (extractTextFromContent(itemObj.content).toLowerCase().includes("generate a comprehensive answer") ||
                     extractTextFromContent(itemObj.content).toLowerCase().includes("comprehensive answer"));
                }
                return false;
              });
            
              if (isDev) {
                console.debug("[ChatKitPanel] Generate request found at index:", generateRequestIndex);
              }
              
              // Look for assistant responses after our request, or just get the last assistant message
              for (let i = threadObj.items.length - 1; i >= 0; i--) {
                const item = threadObj.items[i];
                if (typeof item === "object" && item !== null && "role" in item && "content" in item) {
                  const itemObj = item as { role: unknown; content: unknown };
                  if (itemObj.role === "assistant" && itemObj.content) {
                    // If we found our request, only take responses after it
                    if (generateRequestIndex === -1 || i > generateRequestIndex) {
                      assistantResponse = itemObj as { content: unknown };
                      break;
                    }
                  }
                }
              }
              
              // Fallback: if no specific response found, just get the last assistant message
              if (!assistantResponse) {
                for (let i = threadObj.items.length - 1; i >= 0; i--) {
                  const item = threadObj.items[i];
                  if (typeof item === "object" && item !== null && "role" in item && "content" in item) {
                    const itemObj = item as { role: unknown; content: unknown };
                    if (itemObj.role === "assistant" && itemObj.content) {
                      assistantResponse = itemObj as { content: unknown };
                      break;
                    }
                  }
                }
              }
            
              if (isDev) {
                console.debug("[ChatKitPanel] Assistant response found:", assistantResponse);
              }
              
              if (assistantResponse && assistantResponse.content) {
                const answerText = extractTextFromContent(assistantResponse.content);
              
              if (isDev) {
                console.debug("[ChatKitPanel] Extracted answer text:", answerText);
              }
              
                if (answerText) {
                  // Check if this is a proper answer (starts with "Answer:")
                  const trimmedAnswer = answerText.trim();
                  if (trimmedAnswer.toLowerCase().startsWith("answer:")) {
                    // Extract the actual answer content (remove the "Answer:" prefix)
                    const actualAnswer = trimmedAnswer.substring(7).trim(); // 7 = length of "Answer:"
                    
                    if (actualAnswer) {
                      setGeneratedAnswer(actualAnswer);
                      setIsGenerating(false);
                      pendingAnswerRef.current = false;
                      return;
                    }
                  } else {
                    // There's a response but it's not a proper answer (doesn't start with "Answer:")
                    // This means the agent responded but didn't generate an answer
                    if (isDev) {
                      console.debug("[ChatKitPanel] Response received but not a generated answer (missing 'Answer:' prefix):", answerText);
                    }
                    // Clear the generating state since no answer was generated
                    setIsGenerating(false);
                    pendingAnswerRef.current = false;
                    return;
                  }
                }
              }
            }
            
            // If we didn't find an answer, try again after a longer delay
            if (isDev) {
              console.debug("[ChatKitPanel] No answer text extracted, trying again...");
            }
            
            setTimeout(() => {
              if (pendingAnswerRef.current) {
                const retryThread = currentChatkit?.control?.getThread?.() || 
                                   currentChatkit?.getThread?.() || 
                                   chatkitControlRef.current?.getThread?.();
                if (retryThread && typeof retryThread === "object" && retryThread !== null && "items" in retryThread) {
                  const retryThreadObj = retryThread as { items?: unknown[] };
                  if (retryThreadObj.items && Array.isArray(retryThreadObj.items) && retryThreadObj.items.length > 0) {
                    // Try the same logic again
                    for (let i = retryThreadObj.items.length - 1; i >= 0; i--) {
                      const item = retryThreadObj.items[i];
                      if (typeof item === "object" && item !== null && "role" in item && "content" in item) {
                        const itemObj = item as { role: unknown; content: unknown };
                        if (itemObj.role === "assistant" && itemObj.content) {
                          const retryAnswerText = extractTextFromContent(itemObj.content);
                          if (retryAnswerText) {
                            const trimmedRetryAnswer = retryAnswerText.trim();
                            if (trimmedRetryAnswer.toLowerCase().startsWith("answer:")) {
                              const actualRetryAnswer = trimmedRetryAnswer.substring(7).trim();
                              if (actualRetryAnswer) {
                                setGeneratedAnswer(actualRetryAnswer);
                                setIsGenerating(false);
                                pendingAnswerRef.current = false;
                                return;
                              }
                            } else {
                              // Response doesn't have Answer: prefix, clear state
                              setIsGenerating(false);
                              pendingAnswerRef.current = false;
                              return;
                            }
                          }
                        }
                      }
                    }
                  }
                }
                
                // If still no answer after retry, clear the generating state
                console.warn("[ChatKitPanel] Could not extract answer from thread after retry");
                setIsGenerating(false);
                pendingAnswerRef.current = false;
              }
            }, 1500);
          } else {
            // No thread items, try again later
            setTimeout(() => {
              if (pendingAnswerRef.current) {
                const retryThread = currentChatkit?.control?.getThread?.() || 
                                   currentChatkit?.getThread?.() || 
                                   chatkitControlRef.current?.getThread?.();
                if (retryThread && typeof retryThread === "object" && retryThread !== null && "items" in retryThread) {
                  const retryThreadObj = retryThread as { items?: unknown[] };
                  if (retryThreadObj.items && Array.isArray(retryThreadObj.items) && retryThreadObj.items.length > 0) {
                    for (let i = retryThreadObj.items.length - 1; i >= 0; i--) {
                      const item = retryThreadObj.items[i];
                      if (typeof item === "object" && item !== null && "role" in item && "content" in item) {
                        const itemObj = item as { role: unknown; content: unknown };
                        if (itemObj.role === "assistant" && itemObj.content) {
                          const retryAnswerText = extractTextFromContent(itemObj.content);
                          if (retryAnswerText) {
                            const trimmedRetryAnswer = retryAnswerText.trim();
                            if (trimmedRetryAnswer.toLowerCase().startsWith("answer:")) {
                              const actualRetryAnswer = trimmedRetryAnswer.substring(7).trim();
                              if (actualRetryAnswer) {
                                setGeneratedAnswer(actualRetryAnswer);
                                setIsGenerating(false);
                                pendingAnswerRef.current = false;
                                return;
                              }
                            } else {
                              // Response doesn't have Answer: prefix, clear state
                              setIsGenerating(false);
                              pendingAnswerRef.current = false;
                              return;
                            }
                          }
                        }
                      }
                    }
                  }
                }
                // Clear state if still no answer
                setIsGenerating(false);
                pendingAnswerRef.current = false;
              }
            }, 2000);
          }
        } catch (error) {
          console.error("Error extracting answer from thread:", error);
          setIsGenerating(false);
          pendingAnswerRef.current = false;
        }
      }, 800); // Increased delay to ensure message is fully processed
    }
  }, [onResponseEnd, extractTextFromContent]);

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: theme,
      ...getThemeConfig(theme),
    },
    startScreen: {
      greeting: getQuestionName() ? getQuestionName() : getUserFirstName() ? `Hi ${getUserFirstName()}, how can I help you today?` : GREETING,
      prompts: STARTER_PROMPTS,
    },
    composer: {
      placeholder: PLACEHOLDER_INPUT,
      attachments: {
        // Enable attachments
        enabled: false,
      },
    },
    threadItemActions: {
      feedback: false,
    },
    onClientTool: async (invocation: {
      name: string;
      params: Record<string, unknown>;
    }) => {
      if (invocation.name === "switch_theme") {
        const requested = invocation.params.theme;
        if (requested === "light" || requested === "dark") {
          if (isDev) {
            console.debug("[ChatKitPanel] switch_theme", requested);
          }
          onThemeRequest(requested);
          return { success: true };
        }
        return { success: false };
      }

      if (invocation.name === "record_fact") {
        const id = String(invocation.params.fact_id ?? "");
        const text = String(invocation.params.fact_text ?? "");
        if (!id || processedFacts.current.has(id)) {
          return { success: true };
        }
        processedFacts.current.add(id);
        void onWidgetAction({
          type: "save",
          factId: id,
          factText: text.replace(/\s+/g, " ").trim(),
        });
        return { success: true };
      }

      return { success: false };
    },
    onResponseEnd: handleResponseEndWithCapture,
    onResponseStart: () => {
      setErrorState({ integration: null, retryable: false });
    },
    onThreadChange: () => {
      processedFacts.current.clear();
    },
    onError: ({ error }: { error: unknown }) => {
      // Note that Chatkit UI handles errors for your users.
      // Thus, your app code doesn't need to display errors on UI.
      console.error("ChatKit error", error);
    },
  });

  // Handle generating answer using ChatKit
  const handleGenerateAnswer = useCallback(async () => {
    if (!chatkit.sendUserMessage) {
      console.error("ChatKit sendUserMessage not available");
      return;
    }

    setIsGenerating(true);
    setGeneratedAnswer(null);
    pendingAnswerRef.current = true;

    try {
      // Send a message programmatically through ChatKit
      // This will use the chat context, history, and state variables
      await chatkit.sendUserMessage({
        text: "Generate a comprehensive answer for this question based on our conversation.",
      });
      
      // The response will come through onResponseEnd callback
      // We'll capture it there
    } catch (error) {
      console.error("Error generating answer:", error);
      setIsGenerating(false);
      setGeneratedAnswer("Sorry, there was an error generating the answer.");
      pendingAnswerRef.current = false;
    }
  }, [chatkit]);

  // Handle closing the answer container
  const handleCloseAnswer = useCallback(() => {
    setGeneratedAnswer(null);
    pendingAnswerRef.current = false;
  }, []);

  // Update refs when chatkit becomes available
  useEffect(() => {
    chatkitRef.current = chatkit;
    if (chatkit.control) {
      chatkitControlRef.current = chatkit.control;
    }
  }, [chatkit, chatkit.control]);

  const activeError = errors.session ?? errors.integration;
  const blockingError = errors.script ?? activeError;


  if (isDev) {
    console.debug("[ChatKitPanel] render state", {
      isInitializingSession,
      hasControl: Boolean(chatkit.control),
      scriptStatus,
      hasError: Boolean(blockingError),
      workflowId: WORKFLOW_ID,
    });
  }

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-white">
      <div className="relative flex-1 flex flex-col">
        <ChatKit
          key={widgetInstanceKey}
          control={chatkit.control}
          className={
            blockingError || isInitializingSession
              ? "pointer-events-none opacity-0"
              : "block h-full w-full flex-1"
          }
        />
      </div>
      
      {/* Answer Container - Only shows when answer is generated */}
      {generatedAnswer && chatkitControlRef.current && !blockingError && !isInitializingSession && (
        <div className="w-full px-4 py-3 border-t border-gray-200 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Generated Answer</h3>
              </div>
              
              {/* Content */}
              <div className="px-4 py-4">
                <div className="prose prose-sm max-w-none text-gray-700">
                  <p className="whitespace-pre-wrap leading-relaxed">{generatedAnswer}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Button Area - Generate Answer / Save Answer + Cancel */}
      {getShowGenerateAnswerButton() && chatkitControlRef.current && !blockingError && !isInitializingSession && (
        <div className="w-full px-4 pb-2 mb-[5px]">
          <div className="max-w-4xl mx-auto">
            {generatedAnswer ? (
              // Show Save Answer and Cancel buttons when answer exists
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCloseAnswer}
                  data-cursor-default="true"
                  className="cursor-default-btn flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all"
                  style={{ 
                    fontFamily: 'Inter, sans-serif', 
                    fontSize: '15px',
                    fontWeight: '500',
                    color: '#6d7394',
                    letterSpacing: '0.03em',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveAnswer(generatedAnswer)}
                  disabled={isSaving}
                  data-cursor-default={!isSaving ? "true" : undefined}
                  className="cursor-default-btn flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all disabled:opacity-50 disabled:hover:bg-gray-50 disabled:hover:border-gray-200"
                  style={{ 
                    fontFamily: 'Inter, sans-serif', 
                    fontSize: '15px',
                    fontWeight: '500',
                    color: '#6d7394',
                    letterSpacing: '0.03em',
                    cursor: isSaving ? 'not-allowed' : 'pointer'
                  }}
                >
                  <div className="flex items-center justify-center w-5 h-5">
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: '#740066' }}></div>
                    ) : (
                      <Sparkles size={18} color="#740066" />
                    )}
                  </div>
                  <span style={{ 
                    fontFamily: 'Inter, sans-serif', 
                    fontSize: '15px', 
                    fontWeight: '500',
                    color: '#6d7394',
                    letterSpacing: '0.03em'
                  }}>
                    {isSaving ? "Saving..." : "Save Answer"}
                  </span>
                </button>
              </div>
            ) : (
              // Show Generate Answer button when no answer
              <button
                onClick={handleGenerateAnswer}
                disabled={isGenerating}
                data-cursor-default="true"
                className="cursor-default-btn flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all disabled:opacity-50 disabled:hover:bg-gray-50 disabled:hover:border-gray-200"
                style={{ 
                  fontFamily: 'Inter, sans-serif', 
                  fontSize: '15px',
                  fontWeight: '500',
                  color: '#6d7394',
                  letterSpacing: '0.03em',
                  cursor: isGenerating ? 'not-allowed' : 'pointer'
                }}
              >
                <div className="flex items-center justify-center w-5 h-5">
                  {isGenerating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: '#740066' }}></div>
                  ) : (
                    <Sparkles size={18} color="#740066" />
                  )}
                </div>
                <span style={{ 
                  fontFamily: 'Inter, sans-serif', 
                  fontSize: '15px', 
                  fontWeight: '500',
                  color: '#6d7394',
                  letterSpacing: '0.03em'
                }}>
                  {isGenerating ? "Generating answer..." : "Generate Answer"}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
      
      <ErrorOverlay
        error={blockingError}
        fallbackMessage={
          blockingError || !isInitializingSession
            ? null
            : "Loading assistant session..."
        }
        onRetry={blockingError && errors.retryable ? handleResetChat : null}
        retryLabel="Restart chat"
      />
    </div>
  );
}

function extractErrorDetail(
  payload: Record<string, unknown> | undefined,
  fallback: string
): string {
  if (!payload) {
    return fallback;
  }

  const error = payload.error;
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  const details = payload.details;
  if (typeof details === "string") {
    return details;
  }

  if (details && typeof details === "object" && "error" in details) {
    const nestedError = (details as { error?: unknown }).error;
    if (typeof nestedError === "string") {
      return nestedError;
    }
    if (
      nestedError &&
      typeof nestedError === "object" &&
      "message" in nestedError &&
      typeof (nestedError as { message?: unknown }).message === "string"
    ) {
      return (nestedError as { message: string }).message;
    }
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
}
