export default function MarketingLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-lg">L</span>
        </div>
        <div className="h-1 w-32 bg-muted rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-purple-500 rounded-full animate-[loading_1s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
