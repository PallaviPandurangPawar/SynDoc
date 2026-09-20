// Shows other users' live cursors
// TODO: implement

export default function CursorOverlay({ users, blockIndex }) 
{
  const usersHere = (users || []).filter((u) => u.cursor && u.cursor.blockIndex === blockIndex);
  if (usersHere.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
      {usersHere.map((u) => (
        <span key={u.socketId} style={{ fontSize: '10px', backgroundColor: u.color, color: '#fff', padding: '1px 6px', borderRadius: '8px' }}>
          {u.name} editing
        </span>
      ))}
    </div>
  );
}