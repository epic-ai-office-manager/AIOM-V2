import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSubmit?: (message: string) => void;
  placeholder?: string;
  quickQuestions?: string[];
}

const defaultQuickQuestions = [
  "What's most urgent right now?",
  "Show me all deals over $50K",
  "Why did you send that email?",
  "Explain the cash runway issue",
];

export function ChatInput({
  onSubmit,
  placeholder = "Ask me anything about your business...",
  quickQuestions = defaultQuickQuestions,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Generate suggestions based on input
  useEffect(() => {
    if (input.length > 2) {
      const filtered = quickQuestions.filter(q =>
        q.toLowerCase().includes(input.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [input, quickQuestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = () => {
    if (input.trim()) {
      onSubmit?.(input);
      setInput('');
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const selectQuickQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <button
          onClick={handleSubmit}
          className="absolute right-2 top-2 rounded p-1 hover:bg-gray-100"
          disabled={!input.trim()}
        >
          <Send className={`h-4 w-4 ${input.trim() ? 'text-blue-600' : 'text-gray-400'}`} />
        </button>

        {/* Autocomplete suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => selectSuggestion(suggestion)}
                className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick questions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {quickQuestions.map((q, index) => (
          <button
            key={index}
            onClick={() => selectQuickQuestion(q)}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
