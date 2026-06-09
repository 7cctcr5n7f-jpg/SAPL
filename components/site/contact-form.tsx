"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Send } from "lucide-react"

const SUPPORT_EMAIL = "support@sapl.co.za"

export function ContactForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body = `Name: ${name}\nEmail: ${email}\n\n${message}`
    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject || "SAPL enquiry",
    )}&body=${encodeURIComponent(body)}`
    window.location.href = href
  }

  return (
    <Card className="p-5 md:p-6">
      <h2 className="heading text-lg">Send us a message</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Fill in the form and your email app will open with everything ready to send.
      </p>
      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-name">Name</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact-subject">Subject</Label>
          <Input
            id="contact-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What's this about?"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact-message">Message</Label>
          <Textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us how we can help..."
            rows={6}
            required
          />
        </div>
        <Button type="submit" className="gap-2 self-start">
          <Send className="h-4 w-4" />
          Send Message
        </Button>
      </form>
    </Card>
  )
}
