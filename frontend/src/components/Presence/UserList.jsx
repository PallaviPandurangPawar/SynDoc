// Shows who's currently editing
// TODO: implement

export default function UserList({ users }) 
{
  if (!users || users.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
      <span style={{ fontSize: '12px', color: '#666' }}>Editing now:</span>
      {users.map((user) => (
        <span key={user.socketId} style={{ backgroundColor: user.color, color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
          {user.name}
        </span>
      ))}
    </div>
  );
}
