import React, { useState } from 'react';

interface Props {
  teacherName: string | null;
  onUpdateTeacherName: (name: string) => void;
}

const TeacherSelector: React.FC<Props> = ({
  teacherName,
  onUpdateTeacherName
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(teacherName || '');

  const handleSave = () => {
    if (editedName.trim()) {
      onUpdateTeacherName(editedName.trim());
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditedName(teacherName || '');
    setIsEditing(false);
  };

  return (
    <div className="teacher-selector">
      <h2>Teacher</h2>
      
      {!teacherName && !isEditing ? (
        <div className="empty-state">
          <p>No teacher set yet.</p>
          <button onClick={() => setIsEditing(true)}>Set Teacher Name</button>
        </div>
      ) : isEditing ? (
        <div className="edit-teacher-form">
          <input
            type="text"
            placeholder="Teacher name"
            value={editedName}
            onChange={e => setEditedName(e.target.value)}
            autoFocus
          />
          <div className="button-group">
            <button onClick={handleSave}>Save</button>
            <button onClick={handleCancel}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="teacher-display">
          <div className="teacher-name">{teacherName}</div>
          <button onClick={() => {
            setEditedName(teacherName || '');
            setIsEditing(true);
          }}>
            Edit
          </button>
        </div>
      )}
    </div>
  );
};

export default TeacherSelector;