// Shares AST state across components
// TODO: implement


import { createContext, useContext, useState } from 'react';

// 1. Create the "box" that will hold shared data
const DocumentContext = createContext();

// 2. This component provides that data to everything inside it
export function DocumentProvider({ children }) {
  // ast = the document's structure (Abstract Syntax Tree)
  // setAst = the function to update it
  const [ast, setAst] = useState(null);

  // activeBlockId = which block the user is currently editing
  const [activeBlockId, setActiveBlockId] = useState(null);

  // The "value" object is what every component will be able to access
  const value = {
    ast,
    setAst,
    activeBlockId,
    setActiveBlockId,
  };

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

// 3. A shortcut hook so components don't need to import useContext + DocumentContext every time
export function useDocument() {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocument must be used inside a DocumentProvider');
  }
  return context;
}
