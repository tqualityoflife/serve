import React, { useState, useRef } from "react";
import { ReceiptItem } from "./types";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Tesseract from "tesseract.js";
import './App.css';
import Button from '@mui/material/Button';
import CameraAltIcon from '@mui/icons-material/CameraAlt'; // Import the camera icon
import PersonIcon from '@mui/icons-material/Person';
import FileDownloadIcon from "@mui/icons-material/FileDownload";

function App() {
  enum Tab {
    Input = "Data Entry",
    Preview = "Excel View",
  }
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Input);
  const [items, setItems] = useState<ReceiptItem[]>([]);const [newItem, setNewItem] = useState<ReceiptItem>({
  item: "",
  cost: "" as unknown as number, // or use a union type in your ReceiptItem definition
  people: "",
});
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<ReceiptItem | null>(null);
  const [setTax, setEditTax] = useState<string>("1.199");

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleTaxChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const { name, value } = e.target;
    var targetValue = value;

    const parsedValue = targetValue;

    setEditTax(parsedValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const { name, value } = e.target;
    const parsedValue = name === "cost" ? (value === "" ? "" : parseFloat(value)) : value;

    if (isEdit && editItem) {
      setEditItem({ ...editItem, [name]: parsedValue });
    } else {
      setNewItem({ ...newItem, [name]: parsedValue });
    }
  };

  const addItem = () => {
    if (!newItem.item || newItem.cost === "" || !newItem.people) return;
    setItems([...items, newItem]);
    setNewItem({ item: "", cost: "", people: "" });
  };

  const startEdit = (index: number) => {
    setEditIndex(index);
    setEditItem({ ...items[index] });
  };

  const saveEdit = () => {
    if (editIndex === null || editItem === null) return;
    const updated = [...items];
    updated[editIndex] = editItem;
    setItems(updated);
    setEditIndex(null);
    setEditItem(null);
  };

  const cancelEdit = () => {
    setEditIndex(null);
    setEditItem(null);
  };

  const deleteItem = (index: number) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const duplicateItem = (index: number) => {
    const target = items[index];
    const duplicated: ReceiptItem = {
      item: target.item,
      cost: target.cost,
      people: "",
    };
    const updated = [...items];
    updated.splice(index + 1, 0, duplicated);
    setItems(updated);
    setTimeout(() => {
      setEditIndex(index + 1);
      setEditItem({ ...duplicated });
    }, 0);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { data } = await Tesseract.recognize(file, "eng", {
      logger: (m) => console.log(m),
    });

    const lines = data.text.split("\n").map((line) => line.trim()).filter(Boolean);
    const priceRegex = /(\d+\.\d{2})$/;

    const extractedItems: ReceiptItem[] = [];

    lines.forEach((line) => {
      const match = line.match(priceRegex);
      if (match) {
        const cost = parseFloat(match[1]);
        const item = line.replace(match[1], "").trim();
        if (item) {
          extractedItems.push({ item, cost, people: "" });
        }
      }
    });

    if (extractedItems.length) {
      setItems((prev) => [...prev, ...extractedItems]);
    } else {
      alert("No valid items found in receipt.");
    }
  };

  const generateSharedCostMatrix = (items: ReceiptItem[]) => {
    const peopleSet = new Set<string>();
    items.forEach((item) => {
      item.people.split(",").map((p) => p.toUpperCase().trim()).forEach((p) => {
        if (p !== "ALL") peopleSet.add(p);
      });
    });

    const people = Array.from(peopleSet.add("Total"));
    const rows: any[] = [];
    const totals: Record<string, number> = {};
    people.forEach((p) => (totals[p] = 0));

    items.forEach((item) => {
      const row: any = { item: item.item };
      const peopleInvolved = item.people.toUpperCase().includes("ALL") ? people.filter(x => x !== "Total") : item.people.split(",").map(p => p.toUpperCase().trim());
      const costPerPerson = Number(item.cost)  / peopleInvolved.length;

      people.forEach((p) => {
        if (peopleInvolved.includes(p)) {
          row[p] = parseFloat(costPerPerson.toFixed(2));
          totals[p] += costPerPerson;
        } else {
          row[p] = "";
        }
      });
      rows.push(row);
    });

    const separator: any = { item: " " };
    people.forEach((p) => {
      separator[p] = "";
    });
    rows.push(separator);

    const totalRow: any = { item: "Subtotal" };
    var subtotalAdd = 0.0;
    people.forEach((p) => {
      subtotalAdd += totals[p];
      totalRow[p] = parseFloat(totals[p].toFixed(2));
    });
    totalRow["Total"] = parseFloat(subtotalAdd.toFixed(2));
    rows.push(totalRow);

    const TaxRow: any = { item: "Total with Tax" };
    var totalWithTax = 0.0;
    var taxModifier = (setTax === "" || setTax == null) ? 1.0 : parseFloat(setTax);
    people.forEach((p) => {
      totalWithTax += totals[p] * taxModifier;
      TaxRow[p] = parseFloat((totals[p] * taxModifier).toFixed(2));
    });
    TaxRow["Total"] = parseFloat(totalWithTax.toFixed(2));
    rows.push(TaxRow);

    return { people, rows };
  };

  return (
    <div className="App">
      <header className="App-header"><p>Cost Calculation</p>

        <div>
          {Object.values(Tab).map((tab) => (
            <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`${activeTab === tab ? "TabsSelected" : "Tabs"}`}
            >
              <div className="TabText">
                {tab}  
              </div>
            </button>
          ))}
        </div>
        {activeTab === Tab.Input && (
          <div>

            <div className="App-body">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                capture="environment"
                ref={fileInputRef}
                style={{ display: 'none' }}
                />
              <Button variant="contained" startIcon={<CameraAltIcon />}
                sx={{bgcolor: '#1f2937'}} 
                onClick={handleButtonClick}>
                Capture Receipt
              </Button>
            </div>
            <br/>
            <div className="flex gap-2">
              Tax & Service Charge:
              <input
                  name="Tax And Service"
                  placeholder="Tax And Service"
                  value={setTax}
                  type="number"
                  onChange={(e) => handleTaxChange(e)}
                  className="DollarTextBox"
                />
            </div>
            {items.length > 0 && (
              <div>
                <hr></hr>
                {items.map((item, idx) => (
                    editIndex === idx && editItem ? (
                      <div>
                        <p className="item-row">
                          <span>
                            <input
                              type="text"
                              name="item"
                              value={editItem.item}
                              onChange={(e) => handleChange(e, true)}
                              className="ItemTextBox"
                              />
                          </span>
                          <span>
                            <input
                              name="cost"
                              type="number"
                              value={editItem.cost}
                              onChange={(e) => handleChange(e, true)}
                              className="DollarTextBox"
                              />
                            </span>
                        </p>
                        <p className="item-row">
                          <span>
                            <input
                              type="text"
                              name="people"
                              value={editItem.people}
                              onChange={(e) => handleChange(e, true)}
                              className="PersonTextBox"
                              />
                          </span>
                          <span>
                            <button onClick={saveEdit} className="text-green-400 font-medium">Save</button>
                            <button onClick={cancelEdit} className="text-gray-400">Cancel</button>
                          </span>
                        </p>

                      </div>
                    ) : (
                      <div>
                        <p className="item-row">
                          <span>{item.item}</span>
                          <span>
                            ${Number(item.cost).toFixed(2) } 
                            <button onClick={() => duplicateItem(idx)} className="text-blue-400 font-medium">Duplicate</button>
                          </span>
                        </p>
                        <p className="item-row">
                          <span><PersonIcon />{item.people}</span>
                          <span>
                          <button onClick={() => startEdit(idx)} className="text-blue-400 font-medium">Edit</button>
                          <button onClick={() => deleteItem(idx)} className="text-red-400">Delete</button></span>
                        </p>

                      </div>
                )))}
              </div>
            )}
            <div>
              <hr></hr>
              <p className="item-row">
                <span>
                  <input
                    type="text"
                    name="item"
                    placeholder="Item"
                    value={newItem.item}
                    onChange={(e) => handleChange(e)}
                    className="ItemTextBox"
                  />
                </span>
                <span>
                  <input
                    name="cost"
                    type="number"
                    placeholder="Cost"
                    value={newItem.cost}
                    onChange={(e) => handleChange(e)}
                    className="DollarTextBox"
                  />
                  </span>
              </p>
              <p className="item-row">
                <span>
                  <input
                    type="text"
                    name="people"
                    placeholder="people: 'All' or 'Tom, Tim' or 'Tom'"
                    value={newItem.people}
                    onChange={(e) => handleChange(e)}
                    className="PersonTextBox"
                  />
                </span>
                <span>
                  <Button variant="contained"
                    sx={{bgcolor: 'white', color: 'rgb(72, 51, 189)'}} 
                    onClick={addItem}>
                    Add
                  </Button>
                </span>
              </p>
            </div>
        </div>
        )}
        {activeTab === Tab.Preview && (() => {
          const { people, rows } = generateSharedCostMatrix(items);
          return (
            <div style={{ overflowX: 'auto', width: '100%' }}>
            <br />
            {rows.length <= 3 ? (
              <p className="text-center text-gray-400">No items added yet.</p>
            ) : (
              <>
              <table className="min-w-full text-white border-separate border-spacing-0 border border-white bg-black">
                <thead>
                  <tr>
                    <th className="border border-white px-4 py-2 text-left">Item</th>
                    {people.map((p) => (
                      <th key={p} className="border border-white px-4 py-2 text-left">{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="border border-white px-4 py-2 text-left">{row.item}</td>
                      {people.map((p) => (
                        <td key={p} className="border border-white px-4 py-2 text-left">
                          {row[p] !== "" ? `$${row[p]}` : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <br/>

              <Button variant="contained" startIcon={<FileDownloadIcon />}
                sx={{bgcolor: '#1f2937'}} 
                onClick={() => {
                      const worksheet = XLSX.utils.json_to_sheet(rows);
                      const workbook = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(workbook, worksheet, "Receipt");
                      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
                      const data = new Blob([excelBuffer], { type: "application/octet-stream" });
                      saveAs(data, "receipt.xlsx");
                    }}>
                Download Excel
              </Button>
              </>
              
            )}
          </div>
          );
        })()}

      </header>
    </div>
  );
}

export default App;
