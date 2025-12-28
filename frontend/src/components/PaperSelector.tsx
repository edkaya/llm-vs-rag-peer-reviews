interface Paper {
    id: string;
    title: string;
    abstract: string;
}

interface PaperSelectorProps {
    papers: Paper[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    loading: boolean;
}

export function PaperSelector({ papers, selectedIndex, onSelect, loading }: PaperSelectorProps) {
    if (loading) {
        return (
            <div style={{ padding: 16, color: '#888' }}>Loading papers...</div>
        );
    }

    if (papers.length === 0) {
        return (
            <div style={{ padding: 16, color: '#f59e0b' }}>
                No papers loaded. Make sure the backend is running.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ color: '#aaa', fontSize: 14 }}>
                Select Paper ({papers.length} loaded)
            </label>
            <select
                value={selectedIndex}
                onChange={(e) => onSelect(Number(e.target.value))}
                style={{
                    padding: '10px 12px',
                    backgroundColor: '#252525',
                    border: '1px solid #444',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 14,
                    cursor: 'pointer'
                }}
            >
                {papers.map((paper, idx) => (
                    <option key={paper.id} value={idx}>
                        [{idx}] {paper.title.slice(0, 80)}...
                    </option>
                ))}
            </select>

            {papers[selectedIndex] && (
                <div
                    style={{
                        marginTop: 8,
                        padding: 12,
                        backgroundColor: '#252525',
                        borderRadius: 6,
                        fontSize: 13,
                        color: '#aaa'
                    }}
                >
                    <strong style={{ color: '#fff' }}>Abstract:</strong>
                    <p style={{ margin: '8px 0 0 0', lineHeight: 1.5 }}>
                        {papers[selectedIndex].abstract.slice(0, 300)}...
                    </p>
                </div>
            )}
        </div>
    );
}
