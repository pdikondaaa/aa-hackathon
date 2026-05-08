import { useState, useMemo } from 'react';
import { CHECKLIST_ITEMS, REQUIRED_DOCUMENTS } from '../constants/onboardingData';

export function useOnboardingState() {
  const [checklist, setChecklist]             = useState(CHECKLIST_ITEMS);
  const [documents, setDocuments]             = useState(REQUIRED_DOCUMENTS);
  const [checklistFilter, setChecklistFilter] = useState('all');
  const [searchQuery, setSearchQuery]         = useState('');

  const toggleChecklistItem = (id) => {
    setChecklist(prev =>
      prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item)
    );
  };

  const handleUploadDoc = (docId) => {
    setDocuments(prev =>
      prev.map(doc =>
        doc.id === docId ? { ...doc, uploaded: true, fileName: 'document.pdf' } : doc
      )
    );
  };

  const filteredChecklist = useMemo(() => {
    return checklist.filter(item => {
      const matchesFilter = checklistFilter === 'all' || item.category === checklistFilter;
      const matchesSearch = !searchQuery || item.label.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [checklist, checklistFilter, searchQuery]);

  const completedCount = checklist.filter(i => i.completed).length;
  const totalCount     = checklist.length;
  const overallProgress = Math.round((completedCount / totalCount) * 100);

  const uploadedDocs   = documents.filter(d => d.uploaded).length;
  const requiredDocs   = documents.filter(d => d.required).length;
  const pendingDocs    = documents.filter(d => d.required && !d.uploaded).length;

  return {
    checklist,
    filteredChecklist,
    documents,
    checklistFilter,
    setChecklistFilter,
    searchQuery,
    setSearchQuery,
    toggleChecklistItem,
    handleUploadDoc,
    completedCount,
    totalCount,
    overallProgress,
    uploadedDocs,
    requiredDocs,
    pendingDocs,
  };
}
