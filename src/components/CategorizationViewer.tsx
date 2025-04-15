import React, { useState, useEffect } from 'react';
import { AnalysisCategories, writingSampleAnalyzer } from '../services/writingSampleAnalyzer';

interface Props {
  sampleId: string | null;
  teacherName: string;
}

const CategorizationViewer: React.FC<Props> = ({ sampleId, teacherName }) => {
  const [categories, setCategories] = useState<AnalysisCategories | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<keyof AnalysisCategories | null>(null);

  useEffect(() => {
    // Load categories from the analyzer service
    const loadCategories = () => {
      if (!teacherName) return;
      
      setLoading(true);
      
      try {
        // Get categories directly from the analyzer service
        const loadedCategories = writingSampleAnalyzer.getCategories(teacherName);
        
        // Check if we have any data
        const totalSentences = Object.values(loadedCategories).reduce(
          (total, sentences) => total + sentences.length, 0
        );
        
        if (totalSentences === 0) {
          setCategories(null);
        } else {
          setCategories(loadedCategories);
          
          // Auto-select the category with the most sentences
          const categoryCounts = Object.entries(loadedCategories).map(
            ([category, sentences]) => ({ category, count: sentences.length })
          );
          categoryCounts.sort((a, b) => b.count - a.count);
          
          if (categoryCounts.length > 0 && categoryCounts[0].count > 0) {
            setSelectedCategory(categoryCounts[0].category as keyof AnalysisCategories);
          }
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
        setCategories(null);
      } finally {
        setLoading(false);
      }
    };
    
    loadCategories();
  }, [teacherName, sampleId]);

  const getCategoryDisplayName = (category: string): string => {
    switch (category) {
      case 'introduction_context':
        return 'Introduction & Context';
      case 'endorsement':
        return 'Endorsement';
      case 'commentary':
        return 'Commentary';
      case 'qualities':
        return 'Qualities';
      case 'further_discussion':
        return 'Further Discussion';
      default:
        return category;
    }
  };

  const getTotal = (): number => {
    if (!categories) return 0;
    
    return Object.values(categories).reduce(
      (total, sentences) => total + sentences.length, 
      0
    );
  };
  
  const handleClearCategories = () => {
    if (window.confirm('Are you sure you want to clear all categorized sentences? This cannot be undone.')) {
      writingSampleAnalyzer.clearCategories(teacherName);
      setCategories(null);
      setSelectedCategory(null);
    }
  };
  
  const handleExportCategories = () => {
    writingSampleAnalyzer.exportCategories(teacherName);
  };

  if (loading) {
    return (
      <div className="categorization-viewer loading-state">
        <p>Loading categorization...</p>
      </div>
    );
  }
  
  if (!categories || getTotal() === 0) {
    return (
      <div className="categorization-viewer empty-state">
        <p>No categorized sentences available. Analyze a writing sample to see categories.</p>
      </div>
    );
  }

  return (
    <div className="categorization-viewer">
      <h3>Categorized Sentences</h3>
      
      <div className="category-tabs">
        {Object.entries(categories).map(([category, sentences]) => (
          <button
            key={category}
            className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category as keyof AnalysisCategories)}
          >
            {getCategoryDisplayName(category)}
            <span className="count">{sentences.length}</span>
          </button>
        ))}
        <div className="category-tab total">
          Total
          <span className="count">{getTotal()}</span>
        </div>
      </div>
      
      {selectedCategory && (
        <div className="sentence-list">
          <h4>{getCategoryDisplayName(selectedCategory)}</h4>
          {categories[selectedCategory].length === 0 ? (
            <p className="empty-category">No sentences in this category</p>
          ) : (
            <ul>
              {categories[selectedCategory].map((sentence: string, index: number) => (
                <li key={index} className="sentence-item">
                  {sentence}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      <div className="viewer-actions">
        <button 
          className="action-button export-button"
          onClick={handleExportCategories}
          title="Download categorized sentences as text files"
        >
          Export Categories
        </button>
        
        <button 
          className="action-button log-button"
          onClick={() => {
            // Log all categories to console
            console.group('Complete Sentence Categorization');
            Object.entries(categories).forEach(([category, sentences]) => {
              console.group(getCategoryDisplayName(category));
              sentences.forEach((sentence: string, i: number) => console.log(`${i+1}. ${sentence}`));
              console.groupEnd();
            });
            console.groupEnd();
          }}
        >
          Log to Console
        </button>
        
        <button 
          className="action-button clear-button"
          onClick={handleClearCategories}
          title="Clear all categorized sentences"
        >
          Clear All
        </button>
      </div>
    </div>
  );
};

export default CategorizationViewer;