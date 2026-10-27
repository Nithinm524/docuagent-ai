    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (autoplayTimerRef.current !== null) {
        window.clearInterval(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [autoPlay, isAutoPlayActive, imagesReady, images.length, autoPlayInterval, advance]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    lastPointerOriginRef.current = [
      Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    ];
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    event.preventDefault();
    handlePointerMove(event);
    const origin = lastPointerOriginRef.current;
    transitionTo(currentIndexRef.current + 1, origin);
  };

  if (!webglSupported) {
    return <WebGLFallback className={className} />;
  }

  return (
    <div
      ref={rootRef}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      className={cn('relative h-full w-full overflow-hidden select-none', interactive && 'cursor-pointer', className)}
      style={{ backgroundColor: background, borderRadius: `${borderRadius}px`, ...style }}
      aria-label={label}
      title={interactive ? 'Click to trigger a ripple transition' : label}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 block h-full w-full"
        style={{ borderRadius: `${borderRadius}px` }}
      />
      {!imagesReady && <div aria-hidden="true" className="absolute inset-0" style={{ backgroundColor: background }} />}

      {renderOverlay ? renderOverlay(currentIndex, isTransitioning) : null}

      {showControls && images.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between p-4 pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {images.map((_, index) => (
              <button
                key={`${index}-${images[index]}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  transitionTo(index, [0.5, 0.5]);
                }}
                disabled={isTransitioning || !imagesReady}
                aria-label={`Show image ${index + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-all disabled:opacity-50',
                  currentIndex === index ? 'w-6 bg-cyan-400' : 'w-1.5 bg-slate-500/70'
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsAutoPlayActive((active) => !active);
              }}
              aria-label={isAutoPlayActive ? 'Pause autoplay' : 'Start autoplay'}
              title={isAutoPlayActive ? 'Pause autoplay' : 'Start autoplay'}
              className="rounded-lg border border-slate-700/70 bg-slate-900/80 p-2 text-slate-200"
            >
              {isAutoPlayActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                advance();
              }}
              disabled={!imagesReady || isTransitioning}
              aria-label="Next ripple transition"
              title="Next ripple transition"
              className="rounded-lg border border-cyan-700/70 bg-cyan-950/80 p-2 text-cyan-200 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const RippleTransition: React.FC<RippleTransitionProps> = (props) => (
  <WebGLErrorBoundary fallback={<WebGLFallback className={props.className} />}>
    <RippleTransitionCanvas {...props} />
  </WebGLErrorBoundary>
);
