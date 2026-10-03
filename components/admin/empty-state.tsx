export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-[16px] border border-dashed border-[#e5d7d1] bg-[#fbf8f5] px-6 py-10 text-center">
      <p className="text-sm font-medium text-[#4a4442]">{title}</p>
      {description ? <p className="mt-1 text-sm text-[#8a7c78]">{description}</p> : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[16px] border border-[#f1c9c0] bg-[#fff5f3] px-6 py-5 text-sm text-[#7a3a32]">
      {message}
    </div>
  );
}
