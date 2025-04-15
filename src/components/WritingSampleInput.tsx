import React, { useState, useEffect } from 'react';
import { dbStorage } from '../utils/indexedDBStorage';
import { writingSampleAnalyzer } from '../services/writingSampleAnalyzer';
import CategorizationViewer from './CategorizationViewer';

interface Props {
  teacherName: string;
  onSave: (sample: string) => Promise<void>;
  disabled: boolean;
}

interface WritingSample {
  id: string;
  content: string;
  timestamp: number;
  studentName: string | null;
  analyzed?: boolean;
}

interface AnalysisStatus {
  sampleId: string | null;
  isAnalyzing: boolean;
  error: string | null;
  success: boolean;
}

const WritingSampleInput: React.FC<Props> = ({
  teacherName,
  onSave,
  disabled
}) => {
  const [sample, setSample] = useState<string>('');
  const [savedSamples, setSavedSamples] = useState<WritingSample[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [exampleVisible, setExampleVisible] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({
    sampleId: null,
    isAnalyzing: false,
    error: null,
    success: false
  });
  
  // State for viewing categorized sentences
  const [viewingCategories, setViewingCategories] = useState<boolean>(false);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);

  const exampleSample = ``;

  const extractStudentName = (text: string): string | null => {
    const excludedWords = ['admissions', 'university', 'college', 'board', 'committee', 'department', 
      'school', 'program', 'faculty', 'academy', 'institution', 'office', 'council'];
    
    const namePatterns = [
      /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\s*\./,
      /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+[a-z]/,
      /[^.!?]\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/,
      /\b(for|to|by|with|about)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        let firstName, lastName;
        
        if (pattern.toString().includes('for|to|by|with|about')) {
          firstName = match[2];
          lastName = match[3];
        } else {
          firstName = match[1];
          lastName = match[2];
        }
        
        const firstNameLower = firstName.toLowerCase();
        const lastNameLower = lastName.toLowerCase();
        
        if (excludedWords.includes(firstNameLower) || excludedWords.includes(lastNameLower)) {
          continue;
        }
        
        return `${firstName} ${lastName}`;
      }
    }
    
    return null;
  };

  const loadSavedSamples = async () => {
    if (!teacherName) return;
    
    try {
      const samples = await dbStorage.getTeacherWritingSamples(teacherName);
      
      // Get a list of analyzed samples
      const analyses = await dbStorage.getUserInputsByType(teacherName, 'sample-analysis');
      const analyzedSampleIds = new Set<string>(
        analyses.map(analysis => {
          try {
            const metadata = analysis.metadata || {};
            return metadata.originalSampleId || '';
          } catch (e) {
            return '';
          }
        }).filter(id => id !== '')
      );
      
      const transformedSamples = samples.map(sample => ({
        id: sample.id,
        content: sample.content,
        timestamp: sample.timestamp,
        studentName: extractStudentName(sample.content),
        analyzed: analyzedSampleIds.has(sample.id)
      }));
      
      setSavedSamples(transformedSamples);
      
      // If there are samples and none selected, select the first one
      if (transformedSamples.length > 0 && !selectedSampleId) {
        setSelectedSampleId(transformedSamples[0].id);
      }
    } catch (error) {
      console.error('Failed to load writing samples:', error);
    }
  };

  useEffect(() => {
    loadSavedSamples();
  }, [teacherName]);

  const handleSave = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    
    if (!sample.trim()) return;
    
    setIsLoading(true);
    
    try {
      // First save the sample
      await onSave(sample);
      
      // Get the sample ID (latest one for this teacher)
      const samples = await dbStorage.getTeacherWritingSamples(teacherName);
      samples.sort((a, b) => b.timestamp - a.timestamp);
      const latestSample = samples[0];
      
      if (latestSample) {
        // Automatically analyze the sample
        await analyzeSample(latestSample.id, latestSample.content);
        // Set as selected sample and show categories
        setSelectedSampleId(latestSample.id);
        setViewingCategories(true);
      }
      
      setSample('');
      await loadSavedSamples();
    } catch (error) {
      console.error('Failed to save writing sample:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeSample = async (sampleId: string, sampleContent: string) => {
    if (!teacherName) return;
    
    setAnalysisStatus({
      sampleId,
      isAnalyzing: true,
      error: null,
      success: false
    });
    
    try {
      // Call the analyzer service
      const analysis = await writingSampleAnalyzer.analyzeSample(sampleContent, teacherName);
      
      // Update the analysis status
      setAnalysisStatus({
        sampleId,
        isAnalyzing: false,
        error: null,
        success: true
      });
      
      // Update the sample record to include the analysis ID
      await dbStorage.updateUserInputMetadata(sampleId, {
        analyzed: true,
        originalSampleId: sampleId,
        analysisTimestamp: Date.now()
      });
      
      // Show a brief success message
      setTimeout(() => {
        setAnalysisStatus(prev => ({
          ...prev,
          success: false,
          sampleId: null
        }));
      }, 3000);
      
      return analysis;
    } catch (error) {
      console.error('Failed to analyze sample:', error);
      setAnalysisStatus({
        sampleId,
        isAnalyzing: false,
        error: 'Analysis failed',
        success: false
      });
      
      // Clear the error message after a delay
      setTimeout(() => {
        setAnalysisStatus(prev => ({
          ...prev,
          error: null,
          sampleId: null
        }));
      }, 3000);
      
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (!teacherName) return;
    
    setIsDeleting(id);
    
    try {
      await dbStorage.deleteUserInput(id);
      
      // If the deleted sample was selected, clear the selection
      if (selectedSampleId === id) {
        setSelectedSampleId(null);
      }
      
      await loadSavedSamples();
    } catch (error) {
      console.error('Failed to delete writing sample:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleManualAnalysis = async (sampleId: string, content: string) => {
    try {
      await analyzeSample(sampleId, content);
      setViewingCategories(true);
      await loadSavedSamples();
    } catch (error) {
      console.error('Manual analysis failed:', error);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString();
  };

  const truncateText = (text: string, maxLength: number = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const useExample = () => {
    setSample(exampleSample);
    setExampleVisible(false);
  };

  return (
    <div className="writing-sample-input">
      <div className="section-header">
        <h2>Writing Samples</h2>
        <div className="view-toggle">
          <button 
            className={`toggle-button ${!viewingCategories ? 'active' : ''}`}
            onClick={() => setViewingCategories(false)}
          >
            Samples
          </button>
          <button 
            className={`toggle-button ${viewingCategories ? 'active' : ''}`}
            onClick={() => setViewingCategories(true)}
          >
            Categories
          </button>
        </div>
      </div>
      
      <p className="samples-count">
        Saved samples: <strong>{savedSamples.length}</strong>
        {savedSamples.length < 3 && (
          <span className="samples-hint"> (At least 3 needed for custom model)</span>
        )}
      </p>
      
      {!viewingCategories ? (
        // SAMPLES VIEW
        <>
          <div className="textarea-container">
            <textarea
              placeholder="Paste a sample of the teacher's writing here..."
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              disabled={disabled || isLoading}
              rows={8}
            />
          </div>
          
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || isLoading || !sample.trim()}
            className="save-button"
          >
            {isLoading ? 'Saving & Analyzing...' : 'Save & Analyze Sample'}
          </button>

          {savedSamples.length > 0 && (
            <div className="saved-samples-list">
              <h3>Your Saved Writing Samples</h3>
              <ul>
                {savedSamples.map(sample => (
                  <li 
                    key={sample.id} 
                    className={`sample-item ${selectedSampleId === sample.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSampleId(sample.id)}
                  >
                    <div className="sample-header">
                      <strong className="student-name">
                        {sample.studentName || 'Unknown Student'}
                      </strong>
                      <span className="sample-date">{formatDate(sample.timestamp)}</span>
                      <div className="sample-actions">
                        {!sample.analyzed && (
                          <button 
                            type="button"
                            className="analyze-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleManualAnalysis(sample.id, sample.content);
                            }}
                            disabled={analysisStatus.isAnalyzing && analysisStatus.sampleId === sample.id}
                          >
                            {analysisStatus.isAnalyzing && analysisStatus.sampleId === sample.id 
                              ? 'Analyzing...' 
                              : 'Analyze'}
                          </button>
                        )}
                        {sample.analyzed && (
                          <span className="analyzed-badge" title="This sample has been analyzed">
                            ✓ Analyzed
                          </span>
                        )}
                        <button 
                          type="button"
                          className="delete-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(sample.id);
                          }}
                          disabled={isDeleting === sample.id}
                        >
                          {isDeleting === sample.id ? '...' : '×'}
                        </button>
                      </div>
                    </div>
                    {analysisStatus.sampleId === sample.id && analysisStatus.error && (
                      <div className="analysis-error">
                        {analysisStatus.error}
                      </div>
                    )}
                    {analysisStatus.sampleId === sample.id && analysisStatus.success && (
                      <div className="analysis-success">
                        Analysis complete! Sentences have been categorized.
                      </div>
                    )}
                    
                    {selectedSampleId === sample.id && (
                      <div className="sample-preview">
                        <p className="preview-content">{truncateText(sample.content, 150)}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        // CATEGORIES VIEW
        <CategorizationViewer
          sampleId={selectedSampleId}
          teacherName={teacherName}
        />
      )}
    </div>
  );
};

export default WritingSampleInput;