import React, { useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  disabled: boolean;
}

interface StudentNotes {
  studentName: string;
  schoolProgram: string;
  course: string;
  customCourse?: string;
  whenTaught: string;
  academicStrength: string;
  characterWords: string[];
  academicAnecdote: string;
  characterAnecdote: string;
}

const StudentNotesInput: React.FC<Props> = ({
  value,
  onChange,
  onSave,
  disabled
}) => {
  // Parse existing value into our structured format, or use defaults
  const [notes, setNotes] = useState<StudentNotes>(() => {
    try {
      // Try to parse existing value
      return JSON.parse(value);
    } catch {
      // If not valid JSON or empty, return default structure
      return {
        studentName: '',
        schoolProgram: '',
        course: '',
        customCourse: '',
        whenTaught: '',
        academicStrength: '',
        characterWords: ['', '', ''],
        academicAnecdote: '',
        characterAnecdote: ''
      };
    }
  });

  // List of common courses (can be expanded)
  const [courses, setCourses] = useState<string[]>([]);

  // Handle adding a new course to the dropdown
  const [newCourse, setNewCourse] = useState<string>('');
  const [showAddCourse, setShowAddCourse] = useState<boolean>(false);

  const handleAddCourse = () => {
    if (newCourse.trim()) {
      setCourses(prev => [...prev, newCourse.trim()]);
      setNotes(prev => ({
        ...prev,
        course: newCourse.trim(),
        customCourse: ''
      }));
      setNewCourse('');
      setShowAddCourse(false);
    }
  };

  // Handle input changes
  const handleInputChange = (field: keyof StudentNotes, value: any) => {
    const updatedNotes = { ...notes, [field]: value };
    setNotes(updatedNotes);
    
    // Convert to string and pass to parent component
    onChange(JSON.stringify(updatedNotes));
  };

  // Handle character word changes
  const handleCharacterWordChange = (index: number, value: string) => {
    const updatedWords = [...notes.characterWords];
    updatedWords[index] = value;
    
    handleInputChange('characterWords', updatedWords);
  };

  // Validate if all required fields have values
  const isValid = (): boolean => {
    return !!(
      notes.studentName.trim() &&
      notes.schoolProgram.trim() &&
      (notes.course.trim() || notes.customCourse?.trim()) &&
      notes.whenTaught.trim() &&
      notes.academicStrength.trim() &&
      notes.characterWords.filter(word => word.trim()).length === 3 &&
      notes.academicAnecdote.trim() &&
      notes.characterAnecdote.trim()
    );
  };

  return (
    <div className="student-notes-input">
      <h2>Student Information</h2>
      <p className="hint">Fill in the following information about the student to generate a personalized recommendation letter.</p>
      
      <div className="form-grid">
        {/* Basic Student Info */}
        <div className="form-group">
          <label htmlFor="studentName">Student Name <span className="required">*</span></label>
          <input
            id="studentName"
            type="text"
            value={notes.studentName}
            onChange={(e) => handleInputChange('studentName', e.target.value)}
            disabled={disabled}
            placeholder="e.g. Jane Smith"
            className="full-width"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="schoolProgram">School/Program They're Applying To <span className="required">*</span></label>
          <input
            id="schoolProgram"
            type="text"
            value={notes.schoolProgram}
            onChange={(e) => handleInputChange('schoolProgram', e.target.value)}
            disabled={disabled}
            placeholder="e.g. Harvard University, Computer Science Program"
            className="full-width"
          />
        </div>
        
        {/* Course Information */}
        <div className="form-group course-group">
          <label htmlFor="course">Course You Taught Them <span className="required">*</span></label>
          <div className="course-input-container">
            <select
              id="course"
              value={notes.course}
              onChange={(e) => handleInputChange('course', e.target.value)}
              disabled={disabled}
              className="course-select"
            >
              <option value="">Select a course</option>
              {courses.map((course, index) => (
                <option key={index} value={course}>{course}</option>
              ))}
              <option value="other">+ Add another course</option>
            </select>
            
            {notes.course === 'other' && (
              <div className="add-course-container">
                <input
                  type="text"
                  value={notes.customCourse || ''}
                  onChange={(e) => handleInputChange('customCourse', e.target.value)}
                  disabled={disabled}
                  placeholder="Enter course name"
                  className="custom-course-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (notes.customCourse?.trim()) {
                      setCourses(prev => [...prev, notes.customCourse!.trim()]);
                      handleInputChange('course', notes.customCourse);
                      handleInputChange('customCourse', '');
                    }
                  }}
                  disabled={disabled || !notes.customCourse?.trim()}
                  className="add-course-button"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="whenTaught">When You Taught Them <span className="required">*</span></label>
          <input
            id="whenTaught"
            type="text"
            value={notes.whenTaught}
            onChange={(e) => handleInputChange('whenTaught', e.target.value)}
            disabled={disabled}
            placeholder="e.g. Fall 2023, Junior Year"
            className="full-width"
          />
        </div>
        
        {/* Academic Strength */}
        <div className="form-group full-width">
          <label>Academic Strength Level <span className="required">*</span></label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="academicStrength"
                value="Top student"
                checked={notes.academicStrength === "Top student"}
                onChange={(e) => handleInputChange('academicStrength', e.target.value)}
                disabled={disabled}
              />
              Top student
            </label>
            
            <label className="radio-label">
              <input
                type="radio"
                name="academicStrength"
                value="Very strong/solid"
                checked={notes.academicStrength === "Very strong/solid"}
                onChange={(e) => handleInputChange('academicStrength', e.target.value)}
                disabled={disabled}
              />
              Very strong/solid
            </label>
            
            <label className="radio-label">
              <input
                type="radio"
                name="academicStrength"
                value="Middle-of-the-pack but curious/growth-oriented"
                checked={notes.academicStrength === "Middle-of-the-pack but curious/growth-oriented"}
                onChange={(e) => handleInputChange('academicStrength', e.target.value)}
                disabled={disabled}
              />
              Middle-of-the-pack but curious/growth-oriented
            </label>
          </div>
        </div>
        
        {/* Character Words */}
        <div className="form-group full-width">
          <label>Character Vibes - 3 Words to Describe Their Character <span className="required">*</span></label>
          <div className="character-words-container">
            {notes.characterWords.map((word, index) => (
              <input
                key={index}
                type="text"
                value={word}
                onChange={(e) => handleCharacterWordChange(index, e.target.value)}
                disabled={disabled}
                placeholder={`Character word ${index + 1}`}
                className="character-word-input"
              />
            ))}
          </div>
        </div>
        
        {/* Anecdotes */}
        <div className="form-group full-width">
          <label htmlFor="academicAnecdote">Academic Interaction Anecdote <span className="required">*</span></label>
          <p className="input-hint">Describe a moment of insight, persistence, or curiosity</p>
          <textarea
            id="academicAnecdote"
            value={notes.academicAnecdote}
            onChange={(e) => handleInputChange('academicAnecdote', e.target.value)}
            disabled={disabled}
            rows={4}
            placeholder="e.g. During our unit on cellular biology, Jane asked an insightful question about mitochondrial DNA that demonstrated her deeper understanding of the material..."
            className="full-width"
          />
        </div>
        
        <div className="form-group full-width">
          <label htmlFor="characterAnecdote">Character Trait or Classroom Behavior Anecdote <span className="required">*</span></label>
          <p className="input-hint">Describe a moment showing integrity, helpfulness, or going above and beyond</p>
          <textarea
            id="characterAnecdote"
            value={notes.characterAnecdote}
            onChange={(e) => handleInputChange('characterAnecdote', e.target.value)}
            disabled={disabled}
            rows={4}
            placeholder="e.g. When a classmate was struggling with an assignment, Jane stayed after class to help them understand the concept, showing her generosity and leadership..."
            className="full-width"
          />
        </div>
      </div>
      
      <div className="actions">
        <button 
          onClick={onSave} 
          disabled={disabled || !isValid()}
          className="save-button"
        >
          Save Student Information
        </button>
      </div>
    </div>
  );
};

export default StudentNotesInput;