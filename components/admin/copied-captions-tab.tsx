"use client"

import { formatDateTime } from "@/lib/date-format"
import { Card } from "@/components/ui/card"
import { Copy } from "lucide-react"

type CopiedCaption = {
  id: number
  caption_text: string
  copied_at: string
  user_email: string
  post_name: string
}

type CopiedCaptionsTabProps = {
  copiedCaptions: CopiedCaption[]
}

export function CopiedCaptionsTab({ copiedCaptions }: CopiedCaptionsTabProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Copy className="w-5 h-5" />
        <h2 className="text-xl font-semibold">Copied Captions</h2>
      </div>

      <div className="space-y-3">
        {copiedCaptions.map((caption) => (
          <Card key={caption.id} className="p-4 bg-muted/50">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">{caption.user_email}</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Post: {caption.post_name} • {formatDateTime(caption.copied_at)}
                </p>
                <p className="text-sm bg-background p-3 rounded border border-border">{caption.caption_text}</p>
              </div>
            </div>
          </Card>
        ))}

        {copiedCaptions.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Copy className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No captions copied yet</p>
          </div>
        )}
      </div>
    </Card>
  )
}
