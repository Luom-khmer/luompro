
import React from 'react';
import { ErrorDetails } from '../types';

interface ErrorMessageProps {
  errorDetails: ErrorDetails;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ errorDetails }) => (
  <div className="w-full p-4 bg-red-900/20 border-2 border-red-800/50 rounded-lg text-red-300" role="alert">
    <div className="flex items-center mb-3">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <h3 className="font-bold text-lg">{errorDetails.title}</h3>
    </div>
    <p className="mb-4 text-sm font-medium">{errorDetails.message}</p>
    {errorDetails.suggestions && errorDetails.suggestions.length > 0 && (
      <div className="border-t border-red-800/50 pt-3">
          <h4 className="font-semibold mb-2 text-sm">Các bước khắc phục sự cố:</h4>
          <ul className="list-disc list-inside space-y-1 text-xs text-red-400">
              {errorDetails.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
          </ul>
      </div>
    )}
  </div>
);

export default ErrorMessage;