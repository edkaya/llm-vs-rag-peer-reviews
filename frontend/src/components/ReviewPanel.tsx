interface ReviewPanelProps {
    review: string;
    title: string;
}

export function ReviewPanel({ review, title }: ReviewPanelProps) {
    return (
        <div style={{ marginTop: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#ccc' }}>{title}</h4>
            <div
                style={{
                    backgroundColor: '#252525',
                    borderRadius: 6,
                    padding: 16,
                    maxHeight: 300,
                    overflowY: 'auto',
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: '#ddd',
                    whiteSpace: 'pre-wrap'
                }}
            >
                {review}
            </div>
        </div>
    );
}
