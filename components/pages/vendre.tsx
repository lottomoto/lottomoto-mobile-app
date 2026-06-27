import { useState, useRef, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Modal, TextInput, ActivityIndicator, Image } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { ChevronDown, Plus, Trash2, Printer, X, Share2 } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import * as qrcode from 'qrcode';
import { Colors, Spacing, Radius } from '@/constants/theme';
import Header from '../include/header';
import api from '@/lib/api';
import { saveDraftFiche, getDraftFiche, clearDraftFiche } from '@/lib/auth';

interface TirageData {
    id: string;
    nom: string;
    ouverture: string;
    fermeture: string;
}

interface BorletteData {
    id: string;
    nom: string;
    code: string;
    tirages: TirageData[];
}

export default function VendreScreen() {
    const insets = useSafeAreaInsets();
    const [borlettes, setBorlettes] = useState<BorletteData[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedTirage, setSelectedTirage] = useState('');
    const [selectedBorlette, setSelectedBorlette] = useState('');
    const [borletteOpen, setBorletteOpen] = useState(false);
    const [borletteLayout, setBorletteLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const borletteRef = useRef<View>(null);

    useFocusEffect(useCallback(() => {
        (async () => {
            try {
                const [borRes, settRes] = await Promise.all([
                    api.get<BorletteData[]>('/borlettes'),
                    api.get<Record<string, string>>('/settings'),
                ]);
                setBorlettes(borRes.data.filter((b) => b.tirages.length > 0));
                setFicheSettings(settRes.data);

                const draft = await getDraftFiche();
                if (draft && draft.lignes?.length > 0) {
                    setSelectedBorlette(draft.borlette || '');
                    setSelectedTirage(draft.tirage || '');
                    setLignes(draft.lignes);
                    nextId.current = Math.max(...draft.lignes.map((l: any) => l.id), 0) + 1;
                    await clearDraftFiche();
                }
                draftReady.current = true;
            } catch { /* */ } finally {
                setLoadingData(false);
            }
        })();
    }, []));

    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const haitiOffset = -4 * 60 * 60000;
    const haitiTime = new Date(utc + haitiOffset);
    const currentTime = `${String(haitiTime.getHours()).padStart(2, '0')}:${String(haitiTime.getMinutes()).padStart(2, '0')}`;

    const currentBorlette = borlettes.find((b) => b.id === selectedBorlette);
    const currentTirages = (currentBorlette?.tirages || []).filter((t) => {
        return currentTime < t.fermeture;
    });

    type FicheLine = { id: number; type: string; numero: string; option: string; prix: string };
    const allOptions = [{ id: 'opt1', label: 'Opt 1' }, { id: 'opt2', label: 'Opt 2' }];

    const [ficheSettings, setFicheSettings] = useState<Record<string, string>>({});
    const [lignes, setLignes] = useState<FicheLine[]>([]);
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState<{ id: number; field: 'option' | 'prix' } | null>(null);
    const [dropdownLayout, setDropdownLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const dropdownRefs = useRef<Record<string, View | null>>({});
    const nextId = useRef(1);

    const getMaxDigits = (type: string) => type === 'jackpot' ? 6 : type === 'lotto5' ? 5 : 4;
    const total = lignes.reduce((sum, l) => sum + Number(l.prix), 0);

    const draftReady = useRef(false);

    useEffect(() => {
        if (!draftReady.current) return;
        if (lignes.length > 0) {
            saveDraftFiche({ borlette: selectedBorlette, tirage: selectedTirage, lignes });
        } else {
            clearDraftFiche();
        }
    }, [lignes, selectedBorlette, selectedTirage]);

    const jackpotEnabled = ficheSettings?.['jackpot.enabled'] === 'true';
    const jackpotPrix = ficheSettings?.['jackpot.prix'] || '100';

    const addLigneWithType = (type: string) => {
        const prix = type === 'jackpot' ? jackpotPrix : '250';
        setLignes(prev => [...prev, { id: nextId.current++, type, numero: '', option: type === 'jackpot' ? 'jackpot' : 'opt1', prix }]);
        setShowTypeModal(false);
    };

    const removeLigne = (id: number) => {
        setLignes(prev => prev.filter(l => l.id !== id));
    };

    const updateNumero = (id: number, val: string) => {
        const ligne = lignes.find(l => l.id === id);
        if (!ligne) return;
        const max = getMaxDigits(ligne.type);
        const cleaned = val.replace(/[^0-9]/g, '').slice(0, max);
        setLignes(prev => prev.map(l => l.id === id ? { ...l, numero: cleaned } : l));
    };

    const updateField = (id: number, field: 'option' | 'prix', val: string) => {
        setLignes(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
        setDropdownOpen(null);
    };

    const handleOpenDropdown = (id: number, field: 'option' | 'prix') => {
        const key = `${field}-${id}`;
        const ref = dropdownRefs.current[key];
        if (ref) {
            ref.measureInWindow((x, y, width, height) => {
                setDropdownLayout({ x, y, width, height });
                setDropdownOpen({ id, field });
            });
        }
    };

    const [submitting, setSubmitting] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);

    const buildReceiptHtml = async (ticket: any, settings: Record<string, string>, includeQr = false) => {
        const showLogo = settings['fiche.show_logo'] !== 'false' && settings['entreprise.logo'];
        const showEntreprise = settings['fiche.show_entreprise'] !== 'false';
        const showTel = settings['fiche.show_tel'] !== 'false';
        const message = settings['fiche.message'] || '';
        const nom = settings['entreprise.nom'] || 'LDML';
        const adresse = settings['entreprise.adresse'] || '';
        const tel = settings['entreprise.telephone'] || '';
        const logo = settings['entreprise.logo'] || '';
        const createdAt = ticket.createdAt ? new Date(ticket.createdAt) : new Date();
        const timeStr = createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

        let qrSvg = '';
        if (includeQr) {
            try { qrSvg = await qrcode.toString(ticket.ref, { type: 'svg', width: 90, margin: 1 }); } catch { /* */ }
        }

        const lignesHtml = (ticket.lignes || []).map((l: any) =>
            `<tr>
                <td style="font-weight:700;letter-spacing:2px;font-family:monospace;font-size:13px">${l.numero}</td>
                <td style="text-align:center">${l.type === 'lotto5' ? 'L5' : l.type === 'jackpot' ? 'JP' : 'L4'}</td>
                <td style="text-align:center">${l.type === 'jackpot' ? '—' : l.option === 'opt1' ? 'Op1' : 'Op2'}</td>
                <td style="text-align:right">${Number(l.prix).toLocaleString()}</td>
            </tr>`
        ).join('');

        return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
        <style>
            *{margin:0;padding:0;box-sizing:border-box}
            body{font-family:-apple-system,sans-serif;width:58mm;margin:0 auto;padding:12px 8px;color:#1a1a1a;font-size:11px}
            .center{text-align:center}
            .logo{width:50px;height:50px;object-fit:contain;margin:0 auto 6px}
            .name{font-size:14px;font-weight:900;margin-bottom:2px}
            .sub{font-size:9px;color:#666;margin-bottom:2px}
            .divider{border-top:1px dashed #ccc;margin:8px 0}
            .row{display:flex;justify-content:space-between;margin-bottom:3px}
            .label{color:#666;font-size:10px}
            .val{font-weight:700;font-size:11px}
            table{width:100%;border-collapse:collapse;margin:4px 0}
            th{font-size:9px;text-transform:uppercase;color:#666;border-bottom:1px solid #ddd;padding:3px 0;text-align:left}
            td{padding:3px 0;font-size:11px}
            .total-row{display:flex;justify-content:space-between;align-items:center;margin-top:6px}
            .total-label{font-size:11px;color:#666}
            .total-val{font-size:16px;font-weight:900}
            .msg{font-size:9px;color:#1a1a1a;text-align:center;margin-top:8px;font-style:italic}
            .qr{text-align:center;margin-top:10px}
            .time{font-size:8px;color:#1a1a1a;text-align:center;margin-top:6px}
        </style></head><body>
            <div class="center">
                ${showLogo ? `<img src="${logo}" class="logo"/>` : ''}
                ${showEntreprise ? `<div class="name">${nom}</div><div class="sub">${adresse}</div>` : ''}
                ${showTel ? `<div class="sub">Tél: ${tel}</div>` : ''}
            </div>
            <div class="divider"></div>
            <div class="row"><span class="label">Réf.</span><span class="val">${ticket.ref}</span></div>
            <div class="row"><span class="label">Borlette</span><span class="val">${ticket.borlette}</span></div>
            <div class="row"><span class="label">Tirage</span><span class="val">${ticket.tirage}</span></div>
            <div class="row"><span class="label">Date</span><span class="val">${dateStr} à ${timeStr}</span></div>
            <div class="divider"></div>
            <table>
                <thead><tr><th>Numéro</th><th style="text-align:center">Type</th><th style="text-align:center">Opt</th><th style="text-align:right">Prix</th></tr></thead>
                <tbody>${lignesHtml}</tbody>
            </table>
            <div class="divider"></div>
            <div class="total-row">
                <span class="total-label">${(ticket.lignes || []).length} ligne(s)</span>
                <span class="total-val">${Number(ticket.total).toLocaleString()} HTG</span>
            </div>
            ${message ? `<div class="msg">${message}</div>` : ''}
            ${qrSvg ? `<div class="qr">${qrSvg}</div>` : ''}
            <div class="time">${ticket.ref} · ${dateStr} ${timeStr}</div>
        </body></html>`;
    };

    const handlePrint = async () => {
        if (!receiptData) return;
        try {
            const html = await buildReceiptHtml(receiptData, ficheSettings, true);
            await Print.printAsync({ html });
        } catch { /* user cancelled */ }
    };

    const handleShare = async () => {
        if (!receiptData) return;
        try {
            const html = await buildReceiptHtml(receiptData, ficheSettings, false);
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
        } catch { /* user cancelled */ }
    };

    const handleSubmitTicket = async () => {
        if (!selectedBorlette || !selectedTirage || lignes.length === 0) return;
        const currentTirage = currentTirages.find(t => t.id === selectedTirage);
        if (!currentTirage) return;

        setSubmitting(true);
        try {
            const { data } = await api.post('/tickets', {
                borletteId: selectedBorlette,
                tirage: currentTirage.nom,
                lignes: lignes.map(l => ({
                    numero: l.numero,
                    type: l.type,
                    option: l.option,
                    prix: Number(l.prix),
                })),
            });
            setShowPreview(false);
            setLignes([]);
            setReceiptData(data);
            setShowReceipt(true);
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Erreur lors de la création';
            Toast.show({ type: 'error', text1: 'Erreur', text2: msg });
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenBorlette = useCallback(() => {
        if (borletteRef.current) {
            borletteRef.current.measureInWindow((x, y, width, height) => {
                setBorletteLayout({ x, y, width, height });
                setBorletteOpen(true);
            });
        }
    }, []);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Header />
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* Borlette & Tirage */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Borlette</Text>
                    <View>
                        <Pressable
                            ref={borletteRef}
                            style={styles.selectButton}
                            onPress={handleOpenBorlette}
                        >
                            <Text style={[styles.selectText, !currentBorlette && { color: Colors.gray }]}>
                                {currentBorlette?.nom || 'Choisir une borlette...'}
                            </Text>
                            <ChevronDown size={16} color={Colors.offWhite} />
                        </Pressable>

                        <Modal
                            visible={borletteOpen}
                            transparent
                            animationType="fade"
                            onRequestClose={() => setBorletteOpen(false)}
                        >
                            <Pressable style={styles.modalOverlay} onPress={() => setBorletteOpen(false)}>
                                <View style={[styles.dropdown, {
                                    top: borletteLayout.y + borletteLayout.height + 4,
                                    left: borletteLayout.x,
                                    width: borletteLayout.width,
                                }]}>
                                    <Pressable
                                        style={[styles.dropdownItem, !selectedBorlette && styles.dropdownItemActive]}
                                        onPress={() => { setSelectedBorlette(''); setSelectedTirage(''); setBorletteOpen(false); }}
                                    >
                                        <Text style={[styles.dropdownText, !selectedBorlette && styles.dropdownTextActive]}>— Aucune —</Text>
                                    </Pressable>
                                    {borlettes.map((b) => (
                                        <Pressable
                                            key={b.id}
                                            style={[styles.dropdownItem, b.id === selectedBorlette && styles.dropdownItemActive]}
                                            onPress={() => {
                                                setSelectedBorlette(b.id);
                                                setSelectedTirage('');
                                                setBorletteOpen(false);
                                            }}
                                        >
                                            <Text style={[styles.dropdownText, b.id === selectedBorlette && styles.dropdownTextActive]}>
                                                {b.nom}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </Pressable>
                        </Modal>
                    </View>

                    {/* Tirage */}
                    {selectedBorlette ? (
                        <>
                            <Text style={[styles.cardTitle, { marginTop: Spacing.lg }]}>Tirage</Text>
                            {currentTirages.length > 0 ? (
                                <View style={styles.tabsRow}>
                                    {currentTirages.map((t) => {
                                        const active = selectedTirage === t.id;
                                        return (
                                            <Pressable
                                                key={t.id}
                                                style={[styles.tab, active && styles.tabActive]}
                                                onPress={() => setSelectedTirage(t.id)}
                                            >
                                                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                                                    {t.nom}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            ) : (
                                <Text style={{ fontSize: 12, color: Colors.red, textAlign: 'center', paddingVertical: Spacing.md }}>
                                    Aucun tirage ouvert pour le moment
                                </Text>
                            )}
                        </>
                    ) : null}
                </View>
                {/* Fiche */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Fiche</Text>
                    {lignes.map((l, i) => (
                        <View key={l.id}>
                            <View style={styles.ficheLiyType}>
                                <Text style={[styles.ficheLiyTypeText, l.type === 'jackpot' && { color: Colors.gold }]}>
                                    {l.type === 'jackpot' ? 'Jackpot' : l.type === 'lotto5' ? 'Lotto 5' : 'Lotto 4'}
                                </Text>
                                <Pressable onPress={() => removeLigne(l.id)}>
                                    <Trash2 size={14} color={Colors.red} />
                                </Pressable>
                            </View>
                            <View style={styles.ficheRow}>
                                <View style={styles.ficheCol}>
                                    {i === 0 && <Text style={styles.ficheColLabel}>Numéro</Text>}
                                    <TextInput
                                        style={styles.ficheInput}
                                        value={l.numero}
                                        onChangeText={(val) => updateNumero(l.id, val)}
                                        placeholder={`${getMaxDigits(l.type)} chif`}
                                        placeholderTextColor={Colors.gray}
                                        keyboardType="number-pad"
                                        maxLength={getMaxDigits(l.type)}
                                    />
                                </View>
                                {l.type !== 'jackpot' && (
                                    <View style={styles.ficheColSmall}>
                                        {i === 0 && <Text style={styles.ficheColLabel}>Options</Text>}
                                        <Pressable
                                            ref={(ref) => { dropdownRefs.current[`option-${l.id}`] = ref; }}
                                            style={styles.ficheDropdown}
                                            onPress={() => handleOpenDropdown(l.id, 'option')}
                                        >
                                            <Text style={styles.ficheDropdownText} numberOfLines={1}>{allOptions.find(o => o.id === l.option)?.label}</Text>
                                            <ChevronDown size={10} color={Colors.gray} />
                                        </Pressable>
                                    </View>
                                )}
                                <View style={styles.ficheColSmall}>
                                    {i === 0 && <Text style={styles.ficheColLabel}>Prix</Text>}
                                    {l.type === 'jackpot' ? (
                                        <View style={[styles.ficheDropdown, { backgroundColor: Colors.gold + '20' }]}>
                                            <Text style={[styles.ficheDropdownText, { color: Colors.gold }]}>{jackpotPrix}</Text>
                                        </View>
                                    ) : (
                                        <Pressable
                                            ref={(ref) => { dropdownRefs.current[`prix-${l.id}`] = ref; }}
                                            style={styles.ficheDropdown}
                                            onPress={() => handleOpenDropdown(l.id, 'prix')}
                                        >
                                            <Text style={styles.ficheDropdownText}>{l.prix}</Text>
                                            <ChevronDown size={10} color={Colors.gray} />
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        </View>
                    ))}
                    <View style={styles.ficheActions}>
                        <Pressable
                            style={[styles.addButton, (!selectedBorlette || !selectedTirage) && { opacity: 0.4 }]}
                            onPress={() => selectedBorlette && selectedTirage && setShowTypeModal(true)}
                            disabled={!selectedBorlette || !selectedTirage}
                        >
                            <Plus size={16} color={Colors.gold} />
                            <Text style={styles.addButtonText}>Ajouter une ligne</Text>
                        </Pressable>
                        {lignes.length > 0 && (
                            <Pressable style={styles.cancelButton} onPress={() => setLignes([])}>
                                <Trash2 size={14} color={Colors.red} />
                                <Text style={styles.cancelButtonText}>Anile fich</Text>
                            </Pressable>
                        )}
                    </View>
                    {/* rezime fich la */}
                    {lignes.length > 0 && (
                        <View style={styles.summary}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Lignes</Text>
                                <Text style={styles.summaryValue}>{lignes.length}</Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Total</Text>
                                <Text style={styles.summaryTotal}>{total.toLocaleString()} <Text style={styles.summaryCurrency}>HTG</Text></Text>
                            </View>
                        </View>
                    )}
                    {/* Validate button */}
                    {lignes.length > 0 && (() => {
                        const isValid = lignes.every(l => l.numero.length === getMaxDigits(l.type));
                        return (
                            <Pressable
                                style={[styles.validateButton, !isValid && styles.validateButtonDisabled]}
                                onPress={() => isValid && setShowPreview(true)}
                                disabled={!isValid}
                            >
                                <Text style={[styles.validateButtonText, !isValid && styles.validateButtonTextDisabled]}>
                                    Valider la fiche
                                </Text>
                            </Pressable>
                        );
                    })()}
                </View>

                {/* Modal chwazi type lotto */}
                <Modal
                    visible={showTypeModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowTypeModal(false)}
                >
                    <Pressable style={styles.typeModalOverlay} onPress={() => setShowTypeModal(false)}>
                        <View style={styles.typeModalContent}>
                            <Text style={styles.typeModalTitle}>Chwazi type lotto</Text>
                            <Pressable style={styles.typeModalOption} onPress={() => addLigneWithType('lotto4')}>
                                <Text style={styles.typeModalOptionText}>Lotto 4</Text>
                                <Text style={styles.typeModalOptionSub}>4 chif</Text>
                            </Pressable>
                            <Pressable style={styles.typeModalOption} onPress={() => addLigneWithType('lotto5')}>
                                <Text style={styles.typeModalOptionText}>Lotto 5</Text>
                                <Text style={styles.typeModalOptionSub}>5 chif</Text>
                            </Pressable>
                            {jackpotEnabled && (
                                <Pressable style={[styles.typeModalOption, { backgroundColor: Colors.gold + '20', borderWidth: 1, borderColor: Colors.gold + '40' }]} onPress={() => addLigneWithType('jackpot')}>
                                    <Text style={[styles.typeModalOptionText, { color: Colors.gold }]}>Jackpot</Text>
                                    <Text style={styles.typeModalOptionSub}>6 chif · {jackpotPrix} HTG</Text>
                                </Pressable>
                            )}
                        </View>
                    </Pressable>
                </Modal>

                {/* Dropdown modal (option ou prix) */}
                <Modal
                    visible={dropdownOpen !== null}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setDropdownOpen(null)}
                >
                    <Pressable style={styles.modalOverlay} onPress={() => setDropdownOpen(null)}>
                        <View style={[styles.dropdown, {
                            top: dropdownLayout.y + dropdownLayout.height + 4,
                            left: dropdownLayout.x,
                            minWidth: 120,
                        }]}>
                            {dropdownOpen?.field === 'option' && allOptions.map((o) => {
                                const current = lignes.find(l => l.id === dropdownOpen.id)?.option;
                                return (
                                    <Pressable
                                        key={o.id}
                                        style={[styles.dropdownItem, current === o.id && styles.dropdownItemActive]}
                                        onPress={() => updateField(dropdownOpen.id, 'option', o.id)}
                                    >
                                        <Text style={[styles.dropdownText, current === o.id && styles.dropdownTextActive]}>
                                            {o.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                            {dropdownOpen?.field === 'prix' && ['250', '500'].map((p) => {
                                const current = lignes.find(l => l.id === dropdownOpen.id)?.prix;
                                return (
                                    <Pressable
                                        key={p}
                                        style={[styles.dropdownItem, current === p && styles.dropdownItemActive]}
                                        onPress={() => updateField(dropdownOpen.id, 'prix', p)}
                                    >
                                        <Text style={[styles.dropdownText, current === p && styles.dropdownTextActive]}>
                                            {p} HTG
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </Pressable>
                </Modal>


            </ScrollView>

            {/* Preview Modal */}
            <Modal
                visible={showPreview}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPreview(false)}
            >
                <View style={styles.previewOverlay}>
                    <View style={styles.previewContainer}>
                        <View style={styles.previewHeader}>
                            <Text style={styles.previewTitle}>Aperçu Fiche</Text>
                            <Pressable onPress={() => setShowPreview(false)}>
                                <X size={20} color={Colors.gray} />
                            </Pressable>
                        </View>

                        <ScrollView contentContainerStyle={styles.previewScroll}>
                            <View style={styles.previewInfo}>
                                <Text style={styles.previewInfoLabel}>Tirage</Text>
                                <Text style={styles.previewInfoValue}>
                                    {currentTirages.find(t => t.id === selectedTirage)?.nom}
                                </Text>
                            </View>
                            <View style={styles.previewInfo}>
                                <Text style={styles.previewInfoLabel}>Borlette</Text>
                                <Text style={styles.previewInfoValue}>
                                    {currentBorlette?.nom}
                                </Text>
                            </View>

                            <View style={styles.previewDivider} />

                            <View style={styles.previewTableHeader}>
                                <Text style={[styles.previewTableCol, { flex: 1 }]}>Numéro</Text>
                                <Text style={[styles.previewTableCol, { width: 60 }]}>Type</Text>
                                <Text style={[styles.previewTableCol, { width: 50 }]}>Option</Text>
                                <Text style={[styles.previewTableCol, { width: 70, textAlign: 'right' }]}>Prix</Text>
                            </View>

                            {lignes.map((l, i) => (
                                <View key={l.id} style={[styles.previewTableRow, i % 2 === 0 && styles.previewTableRowAlt]}>
                                    <Text style={[styles.previewTableCell, { flex: 1, fontWeight: '700', letterSpacing: 2 }]}>
                                        {l.numero || '----'}
                                    </Text>
                                    <Text style={[styles.previewTableCell, { width: 60 }]}>
                                        {l.type === 'jackpot' ? 'JP' : l.type === 'lotto5' ? 'L5' : 'L4'}
                                    </Text>
                                    <Text style={[styles.previewTableCell, { width: 50 }]}>
                                        {l.type === 'jackpot' ? '—' : allOptions.find(o => o.id === l.option)?.label}
                                    </Text>
                                    <Text style={[styles.previewTableCell, { width: 70, textAlign: 'right' }]}>
                                        {l.prix}
                                    </Text>
                                </View>
                            ))}

                            <View style={styles.previewDivider} />

                            <View style={styles.previewTotalRow}>
                                <Text style={styles.previewTotalLabel}>Total ({lignes.length} lignes)</Text>
                                <Text style={styles.previewTotalValue}>{total.toLocaleString()} <Text style={{ fontSize: 10 }}>HTG</Text></Text>
                            </View>
                        </ScrollView>

                        <Pressable
                            style={[styles.printButton, submitting && { opacity: 0.5 }]}
                            onPress={handleSubmitTicket}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color={Colors.navy} />
                            ) : (
                                <Printer size={18} color={Colors.navy} />
                            )}
                            <Text style={styles.printButtonText}>
                                {submitting ? 'Envoi en cours...' : 'Valider et imprimer'}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Receipt Preview Modal */}
            <Modal visible={showReceipt} animationType="slide" statusBarTranslucent onRequestClose={() => setShowReceipt(false)}>
                <View style={[styles.container, { paddingTop: insets.top }]}>
                    <View style={styles.receiptHeader}>
                        <Text style={styles.previewTitle}>Aperçu Reçu</Text>
                        <Pressable onPress={() => setShowReceipt(false)} hitSlop={12}>
                            <X size={22} color={Colors.gray} />
                        </Pressable>
                    </View>

                    <ScrollView contentContainerStyle={{ alignItems: 'center', padding: Spacing.xl }}>
                        {receiptData && (
                            <View style={styles.receiptPaper}>
                                {ficheSettings['fiche.show_logo'] !== 'false' && ficheSettings['entreprise.logo'] ? (
                                    <Image source={{ uri: ficheSettings['entreprise.logo'] }} style={styles.receiptLogo} resizeMode="contain" />
                                ) : null}
                                {ficheSettings['fiche.show_entreprise'] !== 'false' && (
                                    <>
                                        <Text style={styles.receiptEntreprise}>{ficheSettings['entreprise.nom'] || 'LDML'}</Text>
                                        <Text style={styles.receiptSub}>{ficheSettings['entreprise.adresse'] || ''}</Text>
                                    </>
                                )}
                                {ficheSettings['fiche.show_tel'] !== 'false' && (
                                    <Text style={styles.receiptSub}>Tél: {ficheSettings['entreprise.telephone'] || ''}</Text>
                                )}

                                <View style={styles.receiptDivider} />

                                <View style={styles.receiptRow}>
                                    <Text style={styles.receiptLabel}>Réf.</Text>
                                    <Text style={styles.receiptVal}>{receiptData.ref}</Text>
                                </View>
                                <View style={styles.receiptRow}>
                                    <Text style={styles.receiptLabel}>Borlette</Text>
                                    <Text style={styles.receiptVal}>{receiptData.borlette}</Text>
                                </View>
                                <View style={styles.receiptRow}>
                                    <Text style={styles.receiptLabel}>Tirage</Text>
                                    <Text style={styles.receiptVal}>{receiptData.tirage}</Text>
                                </View>
                                <View style={styles.receiptRow}>
                                    <Text style={styles.receiptLabel}>Date</Text>
                                    <Text style={styles.receiptVal}>
                                        {new Date(receiptData.createdAt || receiptData.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {' à '}
                                        {new Date(receiptData.createdAt || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>

                                <View style={styles.receiptDivider} />

                                <View style={styles.receiptTableHeader}>
                                    <Text style={[styles.receiptTableCol, { flex: 1 }]}>Numéro</Text>
                                    <Text style={[styles.receiptTableCol, { width: 30, textAlign: 'center' }]}>Type</Text>
                                    <Text style={[styles.receiptTableCol, { width: 30, textAlign: 'center' }]}>Opt</Text>
                                    <Text style={[styles.receiptTableCol, { width: 50, textAlign: 'right' }]}>Prix</Text>
                                </View>
                                {(receiptData.lignes || []).map((l: any) => (
                                    <View key={l.id} style={styles.receiptTableRow}>
                                        <Text style={[styles.receiptTableCell, { flex: 1, fontWeight: '700', letterSpacing: 2, fontVariant: ['tabular-nums'] }]}>{l.numero}</Text>
                                        <Text style={[styles.receiptTableCell, { width: 30, textAlign: 'center' }]}>{l.type === 'jackpot' ? 'JP' : l.type === 'lotto5' ? 'L5' : 'L4'}</Text>
                                        <Text style={[styles.receiptTableCell, { width: 30, textAlign: 'center' }]}>{l.type === 'jackpot' ? '—' : l.option === 'opt1' ? 'Op1' : 'Op2'}</Text>
                                        <Text style={[styles.receiptTableCell, { width: 50, textAlign: 'right' }]}>{Number(l.prix).toLocaleString()}</Text>
                                    </View>
                                ))}

                                <View style={styles.receiptDivider} />

                                <View style={styles.receiptRow}>
                                    <Text style={styles.receiptLabel}>{(receiptData.lignes || []).length} ligne(s)</Text>
                                    <Text style={styles.receiptTotal}>{Number(receiptData.total).toLocaleString()} HTG</Text>
                                </View>

                                {ficheSettings['fiche.message'] ? (
                                    <Text style={styles.receiptMessage}>{ficheSettings['fiche.message']}</Text>
                                ) : null}

                                <View style={styles.receiptQr}>
                                    <QRCode value={receiptData.ref} size={100} backgroundColor="#FFFFFF" color="#1a1a1a" />
                                </View>
                                <Text style={styles.receiptTime}>
                                    {receiptData.ref} · {new Date(receiptData.createdAt || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(receiptData.createdAt || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.receiptActions}>
                        <Pressable style={styles.receiptShareBtn} onPress={handleShare}>
                            <Share2 size={18} color={Colors.offWhite} />
                            <Text style={styles.receiptShareText}>Partager</Text>
                        </Pressable>
                        <Pressable style={styles.receiptPrintBtn} onPress={handlePrint}>
                            <Printer size={18} color={Colors.navy} />
                            <Text style={styles.receiptPrintText}>Imprimer</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.navy,
    },
    scroll: {
        padding: Spacing.xl,
        gap: Spacing.lg,
    },

    // Card
    card: {
        backgroundColor: Colors.navyLight,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
    },
    cardTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.gray,
        marginBottom: Spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    // Inline layout
    tabsInlineRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    tabsInlineGroup: {
        flex: 1,
    },

    // Tabs
    tabsRow: {
        flexDirection: 'row',
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.md,
        padding: 3,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderRadius: Radius.sm,
    },
    tabActive: {
        backgroundColor: Colors.offWhite,
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.gray,
    },
    tabLabelActive: {
        color: Colors.navy,
        fontWeight: '700',
    },

    // Dropdown select
    selectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    selectText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.offWhite,
    },
    modalOverlay: {
        flex: 1,
    },
    dropdown: {
        position: 'absolute',
        backgroundColor: Colors.navyLight,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.navyMedium,
        overflow: 'hidden',
    },
    dropdownItem: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    dropdownItemActive: {
        backgroundColor: Colors.gold + '20',
    },
    dropdownText: {
        fontSize: 14,
        color: Colors.gray,
    },
    dropdownTextActive: {
        color: Colors.gold,
        fontWeight: '700',
    },

    // Fiche
    ficheRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
    ficheRowBorder: {
        borderTopWidth: 1,
        borderTopColor: Colors.navyMedium,
    },
    ficheCol: {
        flex: 1,
    },
    ficheColSmall: {
        width: 65,
    },
    ficheColLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: Colors.gray,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    ficheInput: {
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: 14,
        fontWeight: '700',
        color: Colors.offWhite,
        fontVariant: ['tabular-nums'],
        letterSpacing: 2,
    },
    ficheDropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
    ficheDropdownText: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.offWhite,
        flex: 1,
    },
    ficheDelete: {
        padding: 4,
    },
    addButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.gold + '40',
        borderRadius: Radius.md,
        borderStyle: 'dashed',
    },
    addButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.gold,
    },
    ficheActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.red + '40',
        borderRadius: Radius.md,
    },
    cancelButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.red,
    },

    // Liy type badge
    ficheLiyType: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Spacing.sm,
        marginBottom: 4,
        borderTopWidth: 1,
        borderTopColor: Colors.navyMedium,
    },
    ficheLiyTypeText: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.gold,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    // Type modal
    typeModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    typeModalContent: {
        backgroundColor: Colors.navyLight,
        borderRadius: Radius.lg,
        padding: Spacing.xl,
        width: 260,
        gap: Spacing.md,
    },
    typeModalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.offWhite,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    typeModalOption: {
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.md,
        padding: Spacing.lg,
        alignItems: 'center',
    },
    typeModalOptionText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.offWhite,
    },
    typeModalOptionSub: {
        fontSize: 12,
        color: Colors.gray,
        marginTop: 2,
    },

    // Summary
    summary: {
        marginTop: Spacing.lg,
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.md,
        padding: Spacing.md,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 13,
        color: Colors.gray,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.offWhite,
    },
    summaryDivider: {
        height: 1,
        backgroundColor: Colors.navyLight,
        marginVertical: Spacing.sm,
    },
    summaryTotal: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.gold,
    },
    summaryCurrency: {
        fontSize: 10,
        fontWeight: '700',
    },

    // Validate button
    validateButton: {
        backgroundColor: Colors.gold,
        borderRadius: Radius.md,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    validateButtonDisabled: {
        backgroundColor: Colors.navyMedium,
    },
    validateButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.navy,
    },
    validateButtonTextDisabled: {
        color: Colors.gray,
    },

    // Preview
    previewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    previewContainer: {
        backgroundColor: Colors.navyLight,
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        maxHeight: '85%',
        paddingBottom: 40,
    },
    previewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: Colors.navyMedium,
    },
    previewTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.offWhite,
    },
    previewScroll: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.lg,
    },
    previewInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    previewInfoLabel: {
        fontSize: 13,
        color: Colors.gray,
    },
    previewInfoValue: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.offWhite,
    },
    previewDivider: {
        height: 1,
        backgroundColor: Colors.navyMedium,
        marginVertical: Spacing.md,
    },
    previewTableHeader: {
        flexDirection: 'row',
        paddingVertical: Spacing.sm,
        marginBottom: 4,
    },
    previewTableCol: {
        fontSize: 10,
        fontWeight: '600',
        color: Colors.gray,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    previewTableRow: {
        flexDirection: 'row',
        paddingVertical: Spacing.sm,
        borderRadius: Radius.sm,
    },
    previewTableRowAlt: {
        backgroundColor: Colors.navyMedium + '60',
    },
    previewTableCell: {
        fontSize: 13,
        color: Colors.offWhite,
    },
    previewTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    previewTotalLabel: {
        fontSize: 14,
        color: Colors.gray,
    },
    previewTotalValue: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.gold,
    },
    printButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.gold,
        borderRadius: Radius.md,
        paddingVertical: Spacing.lg,
        marginHorizontal: Spacing.xl,
        marginTop: Spacing.xl,
    },
    printButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.navy,
    },

    // Receipt
    receiptHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.navyMedium,
    },
    receiptPaper: {
        backgroundColor: '#FFFFFF',
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        width: 220,
        alignItems: 'center',
    },
    receiptLogo: {
        width: 60,
        height: 60,
        marginBottom: Spacing.sm,
    },
    receiptEntreprise: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1a1a1a',
        textAlign: 'center',
    },
    receiptSub: {
        fontSize: 10,
        color: '#888',
        textAlign: 'center',
        marginTop: 2,
    },
    receiptDivider: {
        width: '100%',
        borderTopWidth: 1,
        borderStyle: 'dashed',
        borderTopColor: '#ccc',
        marginVertical: Spacing.md,
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 4,
    },
    receiptLabel: {
        fontSize: 11,
        color: '#888',
    },
    receiptVal: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    receiptTableHeader: {
        flexDirection: 'row',
        width: '100%',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        paddingBottom: 4,
        marginBottom: 4,
    },
    receiptTableCol: {
        fontSize: 9,
        fontWeight: '600',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    receiptTableRow: {
        flexDirection: 'row',
        width: '100%',
        paddingVertical: 3,
    },
    receiptTableCell: {
        fontSize: 12,
        color: '#1a1a1a',
    },
    receiptTotal: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1a1a1a',
    },
    receiptMessage: {
        fontSize: 10,
        color: '#1a1a1a',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: Spacing.md,
    },
    receiptQr: {
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    receiptTime: {
        fontSize: 9,
        color: '#1a1a1a',
        textAlign: 'center',
        marginTop: Spacing.sm,
    },
    receiptActions: {
        flexDirection: 'row',
        gap: Spacing.md,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
        paddingBottom: 40,
    },
    receiptShareBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.navyMedium,
        borderRadius: Radius.md,
        paddingVertical: Spacing.lg,
    },
    receiptShareText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.offWhite,
    },
    receiptPrintBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.gold,
        borderRadius: Radius.md,
        paddingVertical: Spacing.lg,
    },
    receiptPrintText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.navy,
    },
});
