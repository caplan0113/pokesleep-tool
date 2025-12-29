import React, { useCallback, useMemo, useState } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { styled } from '@mui/system';
import PokemonBox from '../../util/PokemonBox';
import BoxFilterConfig from '../../util/PokemonBoxFilter';
import { 
    sortPokemonItems, 
    loadBoxSortConfig, 
    BoxSortType, 
    BoxSortConfig 
} from '../../util/PokemonBoxSort';
import PokemonIcon from '../IvCalc/PokemonIcon';
import PokemonFilterFooter from '../IvCalc/PokemonFilterFooter';
import BoxFilterDialog from '../IvCalc/Box/BoxFilterDialog';
import { StrengthParameter } from '../../util/PokemonStrength';
import { useTranslation } from 'react-i18next';
import StrengthParameterSummary from '../IvCalc/Strength/StrengthParameterSummary';
import IvState, { IvAction } from '../IvCalc/IvState';

interface PartyBoxListProps {
  onSelect: (serial: string) => void;
  parameter: StrengthParameter;
  dispatch: React.Dispatch<IvAction>;
}

export default function PartyBoxList({ onSelect, parameter, dispatch }: PartyBoxListProps) {
  const { t } = useTranslation();
  const evolved = parameter?.evolved ?? true;

  const [box] = useState(() => {
    const b = new PokemonBox();
    b.load();
    return b;
  });

  const [sortConfig, setSortConfig] = useState<BoxSortConfig>(() => loadBoxSortConfig());
  const [filterConfig, setFilterConfig] = useState(new BoxFilterConfig({}));
  const [filterOpen, setFilterOpen] = useState(false);

  const pseudoState = useMemo(() => ({
    parameter: parameter,
    lowerTabIndex: 0,
    energyDialogOpen: false,
  } as unknown as IvState), [parameter]);

  const handleQuickSortChange = useCallback((v: { sort: string; descending: boolean }) => {
    const newConfig: BoxSortConfig = {
      ...sortConfig,
      sort: v.sort as BoxSortType,
      descending: v.descending
    };
    setSortConfig(newConfig);
    localStorage.setItem('PstPokemonBoxParam', JSON.stringify(newConfig));
  }, [sortConfig]);

  const filtered = useMemo(() => 
    filterConfig.filter(box.items, evolved, t), 
    [box.items, filterConfig, evolved, t]
  );

  const [sortedItems, errorMessage] = useMemo(() => 
    sortPokemonItems(filtered, sortConfig.sort, sortConfig.descending, sortConfig.ingredient, sortConfig.mainSkill, parameter, t),
    [filtered, sortConfig, parameter, t]
  );

  return (
    <Box sx={{ mt: 1, pb: 12 }}>
      <Box sx={{ px: 1, mb: 2 }}>
        <StrengthParameterSummary state={pseudoState} dispatch={dispatch} />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 1 }}>
        {sortedItems.length === 0 && (
          <Typography sx={{ m: '4rem auto', color: 'text.secondary' }}>
            {box.items.length === 0 ? t('box is empty') : errorMessage}
          </Typography>
        )}
        {sortedItems.map((item) => (
          <StyledBoxItem 
            key={item.id} 
            onClick={() => onSelect(`${item.serialize()}@${item.filledNickname(t)}`)}
          >
            <header><span className="lv">Lv.</span>{item.iv.level}</header>
            <PokemonIcon idForm={item.iv.idForm} size={40} />
            <footer>{item.filledNickname(t)}</footer>
          </StyledBoxItem>
        ))}
      </Box>

      <Box sx={{ position: 'fixed', bottom: 0, left: 0, width: '100%', zIndex: 1100, bgcolor: '#f76', p: 1 }}>
        <PokemonFilterFooter 
          value={{ isFiltered: !filterConfig.isEmpty, sort: sortConfig.sort, descending: sortConfig.descending }}
          onChange={handleQuickSortChange}
          onFilterButtonClick={() => setFilterOpen(true)}
          sortTypes={["level", "name", "pokedexno", "rp", "total strength", "berry", "ingredient", "skill"]}
        />
      </Box>

      <BoxFilterDialog 
        open={filterOpen} 
        onClose={() => setFilterOpen(false)} 
        value={filterConfig} 
        onChange={setFilterConfig} 
      />
    </Box>
  );
}

const StyledBoxItem = styled(ButtonBase)({
  display: 'flex', 
  flexDirection: 'column', 
  alignItems: 'center', 
  width: '80px', 
  padding: '8px 4px',
  borderRadius: '8px', 
  border: '1px solid #eee', 
  backgroundColor: '#fff',
  '&:active': { backgroundColor: '#f0f0f0' },
  '& header': { fontSize: '0.7rem', fontWeight: 'bold', '& .lv': { color: '#62d540' } },
  '& footer': { fontSize: '0.75rem', color: '#666', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
});