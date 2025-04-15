import React, { useState, useEffect } from 'react';
import { queryService } from './services/queryService';
import { dbStorage } from './utils/indexedDBStorage';
import { contentGenerator } from './services/contentGenerator';
import './App.css';

import TeacherSelector from './components/TeacherSelector';
import WritingSampleInput from './components/WritingSampleInput';
import StudentNotesInput from './components/StudentNotesInput';
import GeneratedContent from './components/GeneratedContent';
import StatusBar from './components/StatusBar';

const DEFAULT_MODEL = 'gemma3';

const App: React.FC = () => {
  const [teacherName, setTeacherName] = useState<string | null>(null);
  const [isServerConnected, setIsServerConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [studentNotes, setStudentNotes] = useState<string>('');
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    const initializeApp = async () => {
      const connected = await queryService.testConnection();
      setIsServerConnected(connected);
      
      if (connected) {
        setStatusMessage('Connected to backend server');
        
        try {
          const savedTeacherName = await dbStorage.getTeacherName();
          if (savedTeacherName) {
            setTeacherName(savedTeacherName);
          }
        } catch (error) {
          console.error('Failed to load teacher name:', error);
        }
      } else {
        setStatusMessage('Failed to connect to backend server. Make sure it\'s running.');
      }
    };
    
    initializeApp();
  }, []);

  const updateTeacherName = async (name: string) => {
    setTeacherName(name);
    
    try {
      await dbStorage.saveTeacherName(name);
      setStatusMessage(`Teacher name set to "${name}"`);
    } catch (error) {
      console.error('Failed to save teacher name:', error);
      setStatusMessage('Error saving teacher name');
    }
  };

  const saveWritingSample = async (sample: string) => {
    if (!teacherName) return;
    
    setIsLoading(true);
    setStatusMessage('Saving writing sample...');
    
    try {
      await dbStorage.saveUserInput({
        id: `sample-${Date.now()}`,
        timestamp: Date.now(),
        content: sample,
        type: 'writing-sample',
        teacherName: teacherName
      });
      
      setStatusMessage('Writing sample saved successfully');
    } catch (error) {
      setStatusMessage('Error saving writing sample');
      console.error('Failed to save writing sample:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveStudentNotes = async () => {
    if (!teacherName || !studentNotes.trim()) return;
    
    try {
      await dbStorage.saveUserInput({
        id: `notes-${Date.now()}`,
        timestamp: Date.now(),
        content: studentNotes,
        type: 'student-note',
        teacherName: teacherName
      });
      
      setStatusMessage('Student notes saved');
    } catch (error) {
      setStatusMessage('Error saving student notes');
      console.error('Failed to save student notes:', error);
    }
  };

  const generateContent = async () => {
    if (!teacherName || !studentNotes.trim()) return;
    
    setIsLoading(true);
    setStatusMessage('Generating content...');
    
    try {
      // First save the student notes
      await saveStudentNotes();
      
      // Use our new content generator service
      const generatedLetter = await contentGenerator.generateContent(
        teacherName,
        studentNotes
      );
      
      // Save the generated content
      await dbStorage.saveUserInput({
        id: `generated-${Date.now()}`,
        timestamp: Date.now(),
        content: generatedLetter,
        type: 'generated-content',
        teacherName: teacherName
      });
      
      setGeneratedContent(generatedLetter);
      setStatusMessage('Content generated successfully');
    } catch (error) {
      setStatusMessage('Error generating content');
      console.error('Failed to generate content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>Rec Writer</h1>
        <StatusBar 
          isConnected={isServerConnected} 
          message={statusMessage} 
        />
      </header>
      
      <main>
        <div className="left-panel">
          <TeacherSelector 
            teacherName={teacherName}
            onUpdateTeacherName={updateTeacherName}
          />
          
          {teacherName && (
            <WritingSampleInput
              onSave={saveWritingSample}
              teacherName={teacherName}
              disabled={isLoading}
            />
          )}
        </div>
        
        <div className="right-panel">
          {teacherName && (
            <>
              <StudentNotesInput
                value={studentNotes}
                onChange={setStudentNotes}
                onSave={saveStudentNotes}
                disabled={isLoading}
              />
              
              <button
                onClick={generateContent}
                disabled={isLoading || !studentNotes.trim()}
                className="generate-btn"
              >
                {isLoading ? 'Generating...' : 'Generate Content'}
              </button>
              
              <GeneratedContent
                content={generatedContent}
                isLoading={isLoading}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;