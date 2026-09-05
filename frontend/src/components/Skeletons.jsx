export function RideCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 animate-pulse">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left column */}
        <div className="flex flex-row md:flex-col items-center md:items-start gap-4 md:w-[140px] shrink-0">
          <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
          <div className="w-20 h-5 bg-slate-200 rounded-full"></div>
        </div>
        
        {/* Right column */}
        <div className="flex-1 space-y-4 border-l-0 md:border-l border-slate-100 md:pl-6 pt-4 md:pt-0">
          <div className="flex justify-between items-center">
            <div className="w-1/3 h-4 bg-slate-200 rounded"></div>
            <div className="w-1/4 h-6 bg-slate-200 rounded"></div>
          </div>
          
          <div className="relative pl-6 space-y-6">
            <div className="absolute left-[3px] top-2 bottom-2 w-0.5 bg-slate-200"></div>
            <div className="w-3/4 h-4 bg-slate-200 rounded"></div>
            <div className="w-2/3 h-4 bg-slate-200 rounded"></div>
          </div>

          <div className="w-full h-10 bg-slate-200 rounded-xl mt-4"></div>
        </div>
      </div>
    </div>
  )
}
