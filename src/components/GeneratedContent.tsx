import React from 'react';

interface Props {
  content: string;
  isLoading: boolean;
}

const GeneratedContent: React.FC<Props> = ({ content, isLoading }) => {
  return (
    <div className="generated-content">
      <h2>Generated Content</h2>
      
      {isLoading ? (
        <div className="loading">
          <p>Generating content...</p>
          <div className="spinner"></div>
        </div>
      ) : content ? (
        <div className="content-area">
          <div className="content-text">{content}</div>
          <div className="content-actions">
            <button onClick={() => navigator.clipboard.writeText(content)}>
              Copy to Clipboard
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-content">
          <p>Generated content will appear here</p>
        </div>
      )}
    </div>
  );
};

export default GeneratedContent;