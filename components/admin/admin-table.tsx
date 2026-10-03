export function AdminTable({ headers, children }: { headers: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[16px] border border-[#eadfd7]">
      <table className="w-full min-w-[560px] border-collapse text-right text-sm">
        <thead>
          <tr className="border-b border-[#eadfd7] bg-[#f7f1ee] text-[0.68rem] uppercase tracking-[0.1em] text-[#8a7c78]">
            {headers.map((header, index) => (
              <th key={index} className="whitespace-nowrap px-4 py-3 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eadfd7]">{children}</tbody>
      </table>
    </div>
  );
}
