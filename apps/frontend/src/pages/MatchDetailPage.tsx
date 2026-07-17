import { useParams } from 'react-router-dom';

export default function MatchDetailPage() {
  const { matchId } = useParams();

  return <h1 className="text-2xl font-semibold">Match {matchId}</h1>;
}
