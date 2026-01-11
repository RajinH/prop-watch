"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Property } from "@/lib/data";

interface AddPropertyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (property: Omit<Property, "id" | "lvr">) => void;
}

export function AddPropertyModal({
  open,
  onOpenChange,
  onAdd,
}: AddPropertyModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    valuation: "",
    loanRemaining: "",
    expenses: "",
    income: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (onAdd) {
      onAdd({
        name: formData.name,
        address: formData.address,
        valuation: Number(formData.valuation) || 0,
        loanRemaining: Number(formData.loanRemaining) || 0,
        expenses: Number(formData.expenses) || 0,
        income: Number(formData.income) || 0,
      });
    }

    // Close modal and reset form
    onOpenChange(false);
    setFormData({
      name: "",
      address: "",
      valuation: "",
      loanRemaining: "",
      expenses: "",
      income: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Property</DialogTitle>
          <DialogDescription>
            Enter the details for your new property investment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Property Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Sydney Apartment"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                placeholder="e.g., 123 Main Street, Sydney NSW 2000"
                value={formData.address}
                onChange={handleChange}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="valuation">Valuation ($)</Label>
                <Input
                  id="valuation"
                  name="valuation"
                  type="number"
                  placeholder="e.g., 850000"
                  value={formData.valuation}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="loanRemaining">Loan Remaining ($)</Label>
                <Input
                  id="loanRemaining"
                  name="loanRemaining"
                  type="number"
                  placeholder="e.g., 600000"
                  value={formData.loanRemaining}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="expenses">Monthly Expenses ($)</Label>
                <Input
                  id="expenses"
                  name="expenses"
                  type="number"
                  placeholder="e.g., 2500"
                  value={formData.expenses}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="income">Monthly Income ($)</Label>
                <Input
                  id="income"
                  name="income"
                  type="number"
                  placeholder="e.g., 3500"
                  value={formData.income}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Add Property</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
